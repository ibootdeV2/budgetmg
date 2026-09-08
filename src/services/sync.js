// ============================================================================
// services/sync.js
// Phase 3 : Offline-first avancé & synchronisation intelligente
// ============================================================================
// Stratégie retenue (volontairement simple et robuste, cf. contrainte
// "prioriser simplicité + robustesse" — clé en contexte de connectivité
// faible/instable) :
//
//   1. PUSH — on envoie au cloud tout enregistrement local marqué `dirty`.
//      - `synced_at === null`  → jamais envoyé  → INSERT distant.
//      - `synced_at` renseigné → déjà existant  → UPDATE distant
//        (y compris pour une suppression : elle est soft-delete localement,
//        donc `deleted_at` fait simplement partie du payload envoyé).
//
//   2. PULL — on récupère les enregistrements distants modifiés depuis la
//      dernière synchro (`remoteListSince`) et on les fusionne localement :
//      - Si l'enregistrement local est `dirty` (modif locale pas encore
//        envoyée) → **on garde la version locale** ("priorité des données
//        locales" demandée dans le cahier des charges). Elle sera renvoyée
//        au prochain push et écrasera le serveur.
//      - Sinon → dernière écriture gagne, comparaison sur `updated_at`.
//      Le repère "dernière synchro" (`lastSyncedAt`) est avancé à l'horodatage
//      SERVEUR le plus récent réellement reçu (pas à l'horloge de l'appareil) :
//      utiliser l'heure locale créerait une fenêtre de course où une écriture
//      concurrente sur un autre appareil finit par ne plus jamais être
//      récupérée. Voir le commentaire dans pullChanges() pour le détail.
//
// Il n'y a pas de file d'attente séparée (`syncQueue` explicite) : le flag
// `dirty` sur chaque enregistrement JOUE ce rôle. C'est plus simple à
// maintenir et ça survit nativement à un rechargement de page ou un crash,
// puisqu'il est déjà persisté dans la même DB locale.
//
// PERFORMANCE — push et pull sont menés EN PARALLÈLE (pas un enregistrement /
// une table après l'autre) : sur un réseau mobile instable où chaque
// aller-retour coûte cher, paralléliser réduit fortement le temps total de
// synchro. Le push reste plafonné à PUSH_CONCURRENCY envois simultanés pour
// ne pas noyer une connexion déjà faible.
//
// La détection réseau, le retry avec backoff et l'appel périodique sont
// gérés côté React par hooks/useOfflineSync.js — ce fichier ne fait que la
// mécanique de synchro elle-même, testable indépendamment de l'UI.
// ============================================================================

import { list, markSynced, mergeRemote, getMeta, setMeta, TABLES } from "./storage";
import { remoteCreate, remoteUpdate, remoteListSince } from "./supabase";

// Champs qui n'existent que côté local (bookkeeping de synchro) : jamais
// envoyés à Supabase, qui n'a pas ces colonnes.
const LOCAL_ONLY_FIELDS = ["dirty", "synced_at"];

// Nombre d'envois (push) menés de front. En parallèle plutôt que un par un
// (gain de latence important sur un réseau mobile instable où chaque
// aller-retour peut prendre 300-800ms), mais plafonné : envoyer 50+ requêtes
// simultanées sur une connexion faible ferait plus de mal que de bien
// (timeouts en cascade). 6 est un bon compromis, proche de la limite de
// connexions concurrentes par hôte des navigateurs en HTTP/1.1.
const PUSH_CONCURRENCY = 6;

function toRemotePayload(record) {
  const payload = { ...record };
  for (const field of LOCAL_ONLY_FIELDS) delete payload[field];
  return payload;
}

function getDirtyRecords(table) {
  // includeDeleted: une suppression en attente de synchro est aussi "dirty".
  return list(table, { includeDeleted: true }).filter((r) => r.dirty);
}

/**
 * Exécute `fn` sur chaque élément de `items`, avec au plus `limit` appels en
 * vol simultanément. Renvoie un tableau de résultats dans le même ordre que
 * `items`, façon Promise.allSettled (jamais de rejet global).
 */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i], i) };
      } catch (err) {
        results[i] = { status: "rejected", reason: err };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Envoie tous les changements locaux en attente vers Supabase, en parallèle. */
export async function pushChanges(userId) {
  if (!userId) return { pushed: 0, failed: 0 };

  const jobs = [];
  for (const table of Object.values(TABLES)) {
    for (const record of getDirtyRecords(table)) {
      jobs.push({ table, record });
    }
  }
  if (jobs.length === 0) return { pushed: 0, failed: 0 };

  const results = await mapWithConcurrency(jobs, PUSH_CONCURRENCY, async ({ table, record }) => {
    const payload = toRemotePayload(record);
    const remote = record.synced_at
      ? await remoteUpdate(table, record.id, payload)
      : await remoteCreate(table, payload, userId);
    markSynced(table, record.id, remote.updated_at);
  });

  let pushed = 0;
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      pushed += 1;
    } else {
      const { table, record } = jobs[i];
      // On laisse `dirty: true` : le prochain passage réessaiera cette ligne.
      console.error(`[sync] Échec d'envoi ${table}/${record.id} :`, r.reason?.message);
      failed += 1;
    }
  });

  return { pushed, failed };
}

/** Récupère les changements distants (autres appareils) et les fusionne localement. */
export async function pullChanges(userId) {
  if (!userId) return { pulled: 0, failed: 0, watermark: null };

  const { lastSyncedAt } = getMeta();
  const tables = Object.values(TABLES);

  // Les 3 tables sont indépendantes : on les interroge toutes en même temps
  // plutôt que l'une après l'autre (÷3 sur le temps de cette étape).
  const results = await Promise.allSettled(
    tables.map((table) => remoteListSince(table, lastSyncedAt))
  );

  let pulled = 0;
  let failed = 0;
  // On avance le repère "dernière synchro" à l'horodatage serveur le plus
  // récent RÉELLEMENT REÇU (pas à l'heure de l'appareil qui synchronise :
  // deux appareils n'ont jamais exactement la même horloge, et même sur un
  // seul appareil, l'horloge locale au moment où le pull SE TERMINE est
  // toujours postérieure à l'instant où la requête a été exécutée sur le
  // serveur. Utiliser "maintenant" côté client crée une fenêtre de course :
  // une écriture faite sur un autre appareil pile pendant ce cycle de sync
  // peut se retrouver avec un `updated_at` antérieur au nouveau repère, et
  // n'être alors plus jamais récupérée par les pulls suivants — c'est
  // exactement le bug "certaines données ne se synchronisent pas entre
  // appareils", silencieux et difficile à remarquer.
  let latestServerTimestamp = null;

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      for (const remoteRecord of r.value) {
        mergeRemote(tables[i], remoteRecord);
        pulled += 1;
        if (remoteRecord.updated_at && (!latestServerTimestamp || remoteRecord.updated_at > latestServerTimestamp)) {
          latestServerTimestamp = remoteRecord.updated_at;
        }
      }
    } else {
      console.error(`[sync] Échec de récupération ${tables[i]} :`, r.reason?.message);
      failed += 1;
    }
  });

  return { pulled, failed, watermark: latestServerTimestamp };
}

/**
 * Cycle de synchro complet : push puis pull. Ne fait rien si hors-ligne ou
 * non authentifié (appelant responsable de vérifier `navigator.onLine`).
 */
export async function runSync(userId) {
  if (!userId) return { skipped: true };

  const pushResult = await pushChanges(userId);
  const pullResult = await pullChanges(userId);

  // On n'avance le repère que s'il y a une preuve concrète (un horodatage
  // serveur reçu) qu'on peut réellement avancer jusque-là. Si rien n'a été
  // pulled ce coup-ci, on NE TOUCHE PAS à `lastSyncedAt` : au pire, le
  // prochain pull re-vérifie une plage déjà connue (négligeable), plutôt
  // que de risquer de sauter une écriture concurrente.
  if (pullResult.watermark) {
    setMeta({ lastSyncedAt: pullResult.watermark });
  }

  const failed = pushResult.failed + pullResult.failed;
  if (failed > 0) {
    throw new Error(`${failed} élément(s) n'ont pas pu être synchronisés`);
  }

  return { ...pushResult, ...pullResult };
}
