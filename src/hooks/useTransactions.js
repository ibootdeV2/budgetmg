// ============================================================================
// hooks/useTransactions.js
// Phase 4 : Hooks React personnalisés — logique métier des transactions
// ============================================================================
// Sépare la logique de données (storage.js) de l'UI (pages/Transactions.jsx,
// Dashboard.jsx, ...). Le hook lit/écrit en LOCAL uniquement (instantané,
// fonctionne hors-ligne) ; la synchro cloud est gérée en tâche de fond par
// useOfflineSync(), déclenchée automatiquement via l'événement
// "storage:changed" émis par storage.js à chaque mutation.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { list, create, update, remove, bulkCreate, bulkRemove, TABLES } from "@/services/storage";

function inPeriod(dateStr, month, year) {
  const d = new Date(dateStr);
  return (!month || d.getMonth() + 1 === month) && (!year || d.getFullYear() === year);
}

/**
 * @param {object} [options]
 * @param {number} [options.month] - filtre sur un mois (1-12)
 * @param {number} [options.year] - filtre sur une année
 */
export function useTransactions({ month, year } = {}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    setTransactions(list(TABLES.TRANSACTIONS, { sort: "-date" }));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Se remet à jour si une autre partie de l'app modifie les transactions,
  // ou si des données arrivent du cloud (autre appareil).
  useEffect(() => {
    function handle(e) {
      if (!e.detail?.table || e.detail.table === TABLES.TRANSACTIONS) refresh();
    }
    window.addEventListener("storage:changed", handle);
    window.addEventListener("storage:synced", handle);
    return () => {
      window.removeEventListener("storage:changed", handle);
      window.removeEventListener("storage:synced", handle);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!month && !year) return transactions;
    return transactions.filter((t) => inPeriod(t.date, month, year));
  }, [transactions, month, year]);

  const addTransaction = useCallback(
    (data) => {
      const record = create(TABLES.TRANSACTIONS, data);
      refresh();
      return record;
    },
    [refresh]
  );

  const updateTransaction = useCallback(
    (id, patch) => {
      const record = update(TABLES.TRANSACTIONS, id, patch);
      refresh();
      return record;
    },
    [refresh]
  );

  const removeTransaction = useCallback(
    (id) => {
      const result = remove(TABLES.TRANSACTIONS, id);
      refresh();
      return result;
    },
    [refresh]
  );

  /** Supprime plusieurs transactions d'un coup (sélection multiple), une seule écriture + un seul refresh. */
  const removeTransactions = useCallback(
    (ids) => {
      const result = bulkRemove(TABLES.TRANSACTIONS, ids);
      refresh();
      return result;
    },
    [refresh]
  );

  /** Insère plusieurs transactions d'un coup (ex. import Excel/CSV), une seule écriture + un seul refresh. */
  const importTransactions = useCallback(
    (rows) => {
      const records = bulkCreate(TABLES.TRANSACTIONS, rows);
      refresh();
      return records;
    },
    [refresh]
  );

  return {
    transactions: filtered,
    allTransactions: transactions,
    loading,
    addTransaction,
    updateTransaction,
    removeTransaction,
    removeTransactions,
    importTransactions,
    refresh,
  };
}
