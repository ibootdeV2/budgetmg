// ============================================================================
// hooks/useOfflineSync.js
// Phase 3 : Offline-first avancé & synchronisation intelligente
// ============================================================================
// Ce hook est la partie "vivante" (React) de la synchro : il décide QUAND
// appeler services/sync.js#runSync :
//   - au montage, si en ligne et connecté ;
//   - dès que le navigateur repasse en ligne (`window.addEventListener("online")`) ;
//   - périodiquement tant que l'app reste ouverte et connectée (filet de
//     sécurité, ex. si un webhook/trigger a changé des données ailleurs) ;
//   - en cas d'échec, avec un retry à backoff exponentiel plafonné, pour ne
//     pas marteler un réseau déjà instable (contexte faible connectivité).
//
// Expose : { isOnline, isSyncing, pendingCount, lastSyncedAt, syncNow }
// À utiliser une fois, en haut de l'app (ex. dans Layout), puis à afficher
// via un petit composant de statut (SyncStatus.jsx).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { runSync } from "@/services/sync";
import { subscribeToRemoteChanges } from "@/services/supabase";
import { countDirty, getMeta, mergeRemote, setMeta } from "@/services/storage";
import { useToast } from "@/components/ui/use-toast";

const BASE_RETRY_DELAY_MS = 5_000; // 5 secondes
const MAX_RETRY_DELAY_MS = 5 * 60_000; // 5 minutes
const PERIODIC_SYNC_MS = 60_000; // filet de sécurité toutes les minutes

export function useOfflineSync() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(() => countDirty());
  const [lastSyncedAt, setLastSyncedAt] = useState(() => getMeta().lastSyncedAt);

  const retryDelayRef = useRef(BASE_RETRY_DELAY_MS);
  const retryTimeoutRef = useRef(null);
  const debounceRef = useRef(null);
  const syncingRef = useRef(false); // évite les synchros concurrentes

  const refreshPendingCount = useCallback(() => setPendingCount(countDirty()), []);

  const syncNow = useCallback(async () => {
    if (!user || !navigator.onLine || syncingRef.current) return;

    syncingRef.current = true;
    setIsSyncing(true);
    clearTimeout(retryTimeoutRef.current);

    try {
      await runSync(user.id);
      retryDelayRef.current = BASE_RETRY_DELAY_MS; // succès : backoff réinitialisé
      setLastSyncedAt(getMeta().lastSyncedAt);
    } catch (err) {
      console.error("[useOfflineSync] Échec de synchronisation :", err.message);
      // Nouvelle tentative plus tard, délai croissant (5s, 10s, 20s, ... jusqu'à 5min)
      retryTimeoutRef.current = setTimeout(() => {
        syncingRef.current = false;
        syncNow();
      }, retryDelayRef.current);
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY_MS);
    } finally {
      refreshPendingCount();
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [user, refreshPendingCount]);

  // --- Détection réseau ------------------------------------------------
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      toast({ title: "Connexion rétablie", description: "Synchronisation en cours…" });
      retryDelayRef.current = BASE_RETRY_DELAY_MS;
      syncNow();
    }
    function handleOffline() {
      setIsOnline(false);
      toast({
        variant: "destructive",
        title: "Hors ligne",
        description: "Vos modifications sont enregistrées et seront synchronisées au retour du réseau.",
      });
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow, toast]);

  // --- Réagit aux mutations locales (useTransactions, useBudget, ...) ---
  // Debounce : si l'utilisateur enchaîne plusieurs modifications rapprochées
  // (ex. la grille du Budget annuel), on regroupe en une seule synchro.
  useEffect(() => {
    function handleLocalChange() {
      refreshPendingCount();
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (navigator.onLine) syncNow();
      }, 1500);
    }
    window.addEventListener("storage:changed", handleLocalChange);
    return () => {
      window.removeEventListener("storage:changed", handleLocalChange);
      clearTimeout(debounceRef.current);
    };
  }, [syncNow, refreshPendingCount]);

  // --- Sync au retour au premier plan --------------------------------
  // Cas le plus fréquent en pratique : on a saisi des transactions sur le PC,
  // puis on rouvre l'app (onglet, ou app mobile remise au premier plan) sur
  // le téléphone. On ne veut pas attendre le prochain tick des 60s pour ça.
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === "visible" && navigator.onLine) syncNow();
    }
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [syncNow]);

  // --- Realtime : reçoit quasi instantanément les changements faits sur un
  // autre appareil, sans attendre le prochain pull périodique. Le polling
  // reste actif en filet de sécurité (Realtime peut être temporairement
  // indisponible, ou pas encore activé côté projet Supabase).
  useEffect(() => {
    if (!user) return undefined;

    const unsubscribe = subscribeToRemoteChanges(user.id, (table, remoteRecord) => {
      mergeRemote(table, remoteRecord);
      // Même correctif que pullChanges (services/sync.js) : on avance le
      // repère avec l'horodatage SERVEUR de l'enregistrement reçu, jamais
      // avec l'horloge locale — et jamais en arrière, au cas où un pull
      // classique aurait déjà avancé le repère plus loin entre-temps.
      if (remoteRecord.updated_at) {
        const current = getMeta().lastSyncedAt;
        if (!current || remoteRecord.updated_at > current) {
          setMeta({ lastSyncedAt: remoteRecord.updated_at });
        }
      }
      refreshPendingCount();
    });

    return unsubscribe;
  }, [user, refreshPendingCount]);

  // --- Sync au montage + filet de sécurité périodique -------------------
  useEffect(() => {
    if (!user) return undefined;

    refreshPendingCount();
    syncNow();

    const interval = setInterval(() => {
      if (navigator.onLine) syncNow();
    }, PERIODIC_SYNC_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(retryTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return { isOnline, isSyncing, pendingCount, lastSyncedAt, syncNow, refreshPendingCount };
}
