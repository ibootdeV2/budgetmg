// ============================================================================
// hooks/useAnnualBudgetStats.js
// Étend useBudget() avec les indicateurs "à l'échelle de l'année" dont la
// page Budget a besoin : totaux prévus vs réels, épargne prévue, prévu vs
// réel par catégorie sur les 12 mois, et un repère de progression dans
// l'année en cours. Le calcul mensuel détaillé (Dashboard) reste dans
// useFinancialStats — ce hook-ci est le pendant "annuel" côté page Budget.
// ============================================================================

import { useMemo } from "react";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudget } from "@/hooks/useBudget";
import { ALL_CATEGORIES } from "@/lib/budgetCategories";

/** @param {object} options @param {number} options.year */
export function useAnnualBudgetStats({ year }) {
  const budget = useBudget({ year });
  const { rowTotal, loading: loadingBudget } = budget;
  const { allTransactions, loading: loadingTx } = useTransactions();

  const yearTx = useMemo(
    () => allTransactions.filter((t) => new Date(t.date).getFullYear() === year),
    [allTransactions, year]
  );

  const totalRevenusPrevu = useMemo(
    () => ALL_CATEGORIES.filter((c) => c.type === "Revenu").reduce((s, c) => s + rowTotal(c.name), 0),
    [rowTotal]
  );
  const totalDepensesPrevu = useMemo(
    () => ALL_CATEGORIES.filter((c) => c.type === "Dépense").reduce((s, c) => s + rowTotal(c.name), 0),
    [rowTotal]
  );
  const totalRevenusReel = useMemo(
    () => yearTx.filter((t) => t.type === "Revenu").reduce((s, t) => s + t.amount, 0),
    [yearTx]
  );
  const totalDepensesReel = useMemo(
    () => yearTx.filter((t) => t.type === "Dépense").reduce((s, t) => s + t.amount, 0),
    [yearTx]
  );

  /** Prévu vs réel, sommé sur les 12 mois, pour chaque catégorie de dépense. */
  const budgetVsReelParCategorie = useMemo(() => {
    return ALL_CATEGORIES.filter((c) => c.type === "Dépense")
      .map((c) => {
        const prevu = rowTotal(c.name);
        const reel = yearTx
          .filter((t) => t.category === c.name && t.type === "Dépense")
          .reduce((s, t) => s + t.amount, 0);
        return { name: c.name, Prévu: prevu, Réel: reel };
      })
      .filter((d) => d.Prévu || d.Réel)
      .sort((a, b) => b.Prévu + b.Réel - (a.Prévu + a.Réel));
    // yearTx capture déjà rowTotal via clôture ; rowTotal est stable tant que les lignes ne changent pas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowTotal, yearTx]);

  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const isPastYear = year < now.getFullYear();
  /** % de l'année déjà écoulée — sert de repère pour juger si "déjà dépensé à 40%" est normal ou pas. */
  const pctAnneeEcoulee = isCurrentYear
    ? Math.min(
        100,
        Math.round(((now - new Date(year, 0, 1)) / (new Date(year + 1, 0, 1) - new Date(year, 0, 1))) * 100)
      )
    : isPastYear
    ? 100
    : 0;

  return {
    ...budget,
    loading: loadingBudget || loadingTx,
    totalRevenusPrevu,
    totalDepensesPrevu,
    epargnePrevue: totalRevenusPrevu - totalDepensesPrevu,
    totalRevenusReel,
    totalDepensesReel,
    epargneReelle: totalRevenusReel - totalDepensesReel,
    pctDepensesEngagees: totalDepensesPrevu > 0 ? Math.round((totalDepensesReel / totalDepensesPrevu) * 100) : null,
    budgetVsReelParCategorie,
    isCurrentYear,
    isPastYear,
    pctAnneeEcoulee,
  };
}
