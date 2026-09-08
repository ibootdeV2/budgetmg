// ============================================================================
// services/supabase.js
// Phase 1 : Fondations données — client cloud Supabase
// ============================================================================
// Ce fichier ne fait que DEUX choses volontairement :
//   1. Initialiser le client Supabase (auth + base de données).
//   2. Exposer des fonctions CRUD génériques côté cloud, avec la MÊME forme
//      d'API que services/storage.js (list/get/create/update/remove), pour
//      que les hooks (phase 4) puissent parler indifféremment au local ou
//      au cloud sans changer leur code.
//
// L'authentification (phase 2) et la logique de synchro/queue (phase 3) ne
// sont PAS ici : elles vivront dans hooks/useAuth.js et services/sync.js.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
      "Copiez .env.example vers .env.local et renseignez vos clés Supabase."
  );
}

// ----------------------------------------------------------------------------
// "Se souvenir de moi" — implémenté via un adaptateur de stockage dynamique.
//
// Le SDK Supabase persiste la session dans un seul emplacement fixé à la
// création du client. Pour permettre à l'utilisateur de choisir, à chaque
// connexion, si la session doit survivre à la fermeture du navigateur, on lui
// fournit un objet "storage" custom qui redirige vers localStorage (persiste)
// ou sessionStorage (effacée à la fermeture de l'onglet) selon un simple
// drapeau — mis à jour juste avant l'appel à signInWithPassword.
// ----------------------------------------------------------------------------
const REMEMBER_ME_KEY = "kasaina:remember-me";

function getRememberMe() {
  // Par défaut true : conserve le comportement historique (session persistante)
  // pour toute session déjà ouverte avant ce changement, ou créée sans passer
  // par le formulaire de connexion (ex. lien de confirmation d'inscription).
  const stored = window.localStorage.getItem(REMEMBER_ME_KEY);
  return stored === null ? true : stored === "true";
}

/** À appeler juste avant signIn() avec le choix de la case "Se souvenir de moi". */
export function setRememberMe(remember) {
  window.localStorage.setItem(REMEMBER_ME_KEY, remember ? "true" : "false");
}

const dynamicAuthStorage = {
  getItem: (key) => (getRememberMe() ? window.localStorage : window.sessionStorage).getItem(key),
  setItem: (key, value) => (getRememberMe() ? window.localStorage : window.sessionStorage).setItem(key, value),
  removeItem: (key) => {
    // On nettoie les deux emplacements : la session a pu être écrite dans l'un
    // ou l'autre selon le choix fait à la connexion.
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: dynamicAuthStorage,
    detectSessionInUrl: true,
  },
});

/** Fait correspondre les noms de tables "app" (storage.js) aux tables Postgres réelles. */
export const REMOTE_TABLES = Object.freeze({
  transactions: "transactions",
  budget: "budget_lines",
  goals: "savings_goals",
});

function remoteTableName(table) {
  const name = REMOTE_TABLES[table];
  if (!name) throw new Error(`[supabase] Table inconnue: ${table}`);
  return name;
}

/**
 * Liste les enregistrements distants d'un utilisateur.
 * RLS garantit déjà l'isolation par utilisateur côté serveur ; on ne filtre
 * ici que sur des critères métier optionnels (mois, catégorie, ...).
 */
export async function remoteList(table, { filter, sort, limit, includeDeleted = false } = {}) {
  let query = supabase.from(remoteTableName(table)).select("*");

  if (!includeDeleted) query = query.is("deleted_at", null);
  if (filter) {
    for (const [key, value] of Object.entries(filter)) query = query.eq(key, value);
  }
  if (sort) {
    const desc = sort.startsWith("-");
    query = query.order(desc ? sort.slice(1) : sort, { ascending: !desc });
  }
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function remoteCreate(table, data, userId) {
  const { data: created, error } = await supabase
    .from(remoteTableName(table))
    .insert({ ...data, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return created;
}

export async function remoteUpdate(table, id, patch) {
  const { data: updated, error } = await supabase
    .from(remoteTableName(table))
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return updated;
}

/** Soft delete distant (cohérent avec storage.js) : on renseigne deleted_at plutôt que DELETE. */
export async function remoteRemove(table, id) {
  const { error } = await supabase
    .from(remoteTableName(table))
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { id };
}

/** Enregistrements distants modifiés après une date donnée — brique clé pour la synchro (phase 3). */
export async function remoteListSince(table, isoDate) {
  const { data, error } = await supabase
    .from(remoteTableName(table))
    .select("*")
    .gt("updated_at", isoDate ?? "1970-01-01");
  if (error) throw error;
  return data;
}

// ----------------------------------------------------------------------------
// Realtime — pousse les changements d'un appareil vers les autres quasi
// instantanément (en plus du pull périodique, qui reste un filet de sécurité
// si Realtime est indisponible ou pas encore activé côté projet Supabase).
// ----------------------------------------------------------------------------

/**
 * S'abonne aux INSERT/UPDATE Postgres de l'utilisateur sur les 3 tables, et
 * appelle `onChange(appTable, remoteRecord)` à chaque événement. Retourne une
 * fonction de désabonnement à appeler au démontage / changement d'utilisateur.
 *
 * IMPORTANT : nécessite que la réplication "Realtime" soit activée pour ces
 * tables dans le projet Supabase (Database > Replication), sans quoi aucun
 * événement ne sera reçu (le pull périodique continue de fonctionner, lui).
 */
export function subscribeToRemoteChanges(userId, onChange) {
  if (!userId) return () => {};

  const topic = `sync-${userId}`;

  // Si un canal du même nom existe déjà (ex. double montage en React StrictMode,
  // ou changement rapide d'utilisateur avant la fin du désabonnement précédent),
  // on le retire d'abord : sinon supabase.channel() peut renvoyer un canal déjà
  // "subscribed", et .on() lève "cannot add callbacks after subscribe()".
  const existing = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
  if (existing) supabase.removeChannel(existing);

  const channel = supabase.channel(topic);

  for (const [appTable, remoteTable] of Object.entries(REMOTE_TABLES)) {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: remoteTable, filter: `user_id=eq.${userId}` },
      (payload) => {
        if (payload.new && Object.keys(payload.new).length > 0) onChange(appTable, payload.new);
      }
    );
  }

  channel.subscribe();

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    supabase.removeChannel(channel);
  };
}
