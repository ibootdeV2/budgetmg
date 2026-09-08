// ============================================================================
// hooks/useSavingsGoals.js
// Phase 4 : Hooks React personnalisés — logique métier des objectifs d'épargne
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { list, create, update, remove, TABLES } from "@/services/storage";

export function useSavingsGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    setGoals(list(TABLES.SAVINGS_GOALS, { sort: "-created_at" }));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function handle(e) {
      if (!e.detail?.table || e.detail.table === TABLES.SAVINGS_GOALS) refresh();
    }
    window.addEventListener("storage:changed", handle);
    window.addEventListener("storage:synced", handle);
    return () => {
      window.removeEventListener("storage:changed", handle);
      window.removeEventListener("storage:synced", handle);
    };
  }, [refresh]);

  const addGoal = useCallback(
    (data) => {
      const record = create(TABLES.SAVINGS_GOALS, data);
      refresh();
      return record;
    },
    [refresh]
  );

  const removeGoal = useCallback(
    (id) => {
      const result = remove(TABLES.SAVINGS_GOALS, id);
      refresh();
      return result;
    },
    [refresh]
  );

  /** Met à jour des champs libres d'un objectif (ex : contribution mensuelle prévue). */
  const updateGoal = useCallback(
    (id, patch) => {
      const record = update(TABLES.SAVINGS_GOALS, id, patch);
      refresh();
      return record;
    },
    [refresh]
  );

  /** Ajoute un montant au solde déjà épargné d'un objectif. */
  const addFunds = useCallback(
    (goal, amount) => {
      const record = update(TABLES.SAVINGS_GOALS, goal.id, {
        current_amount: (goal.current_amount || 0) + Number(amount || 0),
      });
      refresh();
      return record;
    },
    [refresh]
  );

  return { goals, loading, addGoal, removeGoal, addFunds, updateGoal, refresh };
}
