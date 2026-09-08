// ============================================================================
// hooks/useBudget.js
// Phase 4 : Hooks React personnalisés — logique métier du budget prévisionnel
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { list, create, update, bulkCreate, TABLES } from "@/services/storage";

/** @param {object} [options] @param {number} [options.year] - défaut : année en cours */
export function useBudget({ year } = {}) {
  const targetYear = year || new Date().getFullYear();
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    setLines(list(TABLES.BUDGET_LINES, { filter: { year: targetYear } }));
    setLoading(false);
  }, [targetYear]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    function handle(e) {
      if (!e.detail?.table || e.detail.table === TABLES.BUDGET_LINES) refresh();
    }
    window.addEventListener("storage:changed", handle);
    window.addEventListener("storage:synced", handle);
    return () => {
      window.removeEventListener("storage:changed", handle);
      window.removeEventListener("storage:synced", handle);
    };
  }, [refresh]);

  // map[category][month] = ligne de budget, pour un accès O(1) depuis l'UI (grille)
  const map = useMemo(() => {
    const m = {};
    lines.forEach((l) => {
      if (!m[l.category]) m[l.category] = {};
      m[l.category][l.month] = l;
    });
    return m;
  }, [lines]);

  const getValue = useCallback((category, month) => map[category]?.[month]?.planned_amount || 0, [map]);

  /** Crée ou met à jour la ligne de budget d'une catégorie/mois. */
  const setValue = useCallback(
    (category, month, value) => {
      const amount = Number(value) || 0;
      const existing = map[category]?.[month];
      const record = existing
        ? update(TABLES.BUDGET_LINES, existing.id, { planned_amount: amount })
        : create(TABLES.BUDGET_LINES, { category, month, year: targetYear, planned_amount: amount });
      refresh();
      return record;
    },
    [map, targetYear, refresh]
  );

  /**
   * Applique un même montant à une liste de mois pour une catégorie, en une
   * seule écriture (plus efficace qu'un setValue() par mois, et surtout plus
   * flexible que l'ancien "dupliquer janvier partout") : tous les mois,
   * seulement les mois restants, ou une sélection libre.
   */
  const applyToMonths = useCallback(
    (category, value, months) => {
      const amount = Number(value) || 0;
      const toCreate = [];
      months.forEach((m) => {
        const existing = map[category]?.[m];
        if (existing) {
          if (existing.planned_amount !== amount) {
            update(TABLES.BUDGET_LINES, existing.id, { planned_amount: amount });
          }
        } else {
          toCreate.push({ category, month: m, year: targetYear, planned_amount: amount });
        }
      });
      if (toCreate.length) bulkCreate(TABLES.BUDGET_LINES, toCreate);
      refresh();
    },
    [map, targetYear, refresh]
  );

  /** Applique la valeur de janvier à tous les mois de l'année pour une catégorie. */
  const duplicateAcrossYear = useCallback(
    (category) => {
      applyToMonths(category, getValue(category, 1), Array.from({ length: 12 }, (_, i) => i + 1));
    },
    [applyToMonths, getValue]
  );

  const rowTotal = useCallback(
    (category) => Array.from({ length: 12 }, (_, i) => getValue(category, i + 1)).reduce((s, v) => s + v, 0),
    [getValue]
  );

  /**
   * Reprend le budget d'une autre année (typiquement l'année précédente) comme
   * point de départ pour `targetYear` : écrase les valeurs déjà saisies cette
   * année pour les catégories/mois présents dans l'année source. Renvoie le
   * nombre de lignes copiées (0 si l'année source est vide).
   */
  const copyFromYear = useCallback(
    (sourceYear) => {
      const sourceLines = list(TABLES.BUDGET_LINES, { filter: { year: sourceYear } });
      if (!sourceLines.length) return 0;
      const toCreate = [];
      sourceLines.forEach((l) => {
        const existing = map[l.category]?.[l.month];
        if (existing) {
          update(TABLES.BUDGET_LINES, existing.id, { planned_amount: l.planned_amount });
        } else {
          toCreate.push({
            category: l.category,
            month: l.month,
            year: targetYear,
            planned_amount: l.planned_amount,
          });
        }
      });
      if (toCreate.length) bulkCreate(TABLES.BUDGET_LINES, toCreate);
      refresh();
      return sourceLines.length;
    },
    [map, targetYear, refresh]
  );

  return {
    lines,
    loading,
    year: targetYear,
    getValue,
    setValue,
    applyToMonths,
    duplicateAcrossYear,
    copyFromYear,
    rowTotal,
    refresh,
  };
}
