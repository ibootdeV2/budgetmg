// ============================================================================
// lib/projections.js
// Fonctions pures de simulation "et si" (what-if) et de projection d'objectifs.
// Aucune dépendance externe, aucun accès au storage : facilement testable.
// ============================================================================

const MONTH_NAMES = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

/** Ex: "mars 2027" */
export function formatMonthYear(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Projette la date d'atteinte d'un objectif d'épargne à partir d'un rythme
 * mensuel constant. Renvoie null si le rythme est nul/négatif (pas de
 * projection possible) ou si l'objectif est déjà atteint.
 *
 * @param {number} currentAmount
 * @param {number} targetAmount
 * @param {number} monthlyContribution
 * @param {Date} [from]
 */
export function projectGoalDate(currentAmount, targetAmount, monthlyContribution, from = new Date()) {
  const remaining = targetAmount - currentAmount;
  if (remaining <= 0) return { reached: true, months: 0, date: from };
  if (!monthlyContribution || monthlyContribution <= 0) return null;

  const months = Math.ceil(remaining / monthlyContribution);
  return { reached: false, months, date: addMonths(from, months) };
}

/**
 * Simule l'effet d'une réduction de % sur les dépenses d'une catégorie,
 * sur l'épargne mensuelle et annuelle.
 *
 * @param {number} categoryMonthlySpend - dépense actuelle/moyenne de la catégorie sur le mois
 * @param {number} reductionPct - 0-100 (peut être décimal, ex: 12.5)
 * @param {number} currentMonthlySavings - épargne mensuelle actuelle (kpis.epargne)
 */
export function simulateCategoryReduction(categoryMonthlySpend, reductionPct, currentMonthlySavings) {
  const monthlySaved = categoryMonthlySpend * (reductionPct / 100);
  return {
    monthlySaved,
    annualSaved: monthlySaved * 12,
    newMonthlySavings: currentMonthlySavings + monthlySaved,
    newCategorySpend: categoryMonthlySpend - monthlySaved,
  };
}

/**
 * Simule l'effet d'une réduction exprimée directement en montant (MGA) sur
 * une catégorie, plutôt qu'en pourcentage. Le montant est plafonné à la
 * dépense de la catégorie (on ne peut pas "économiser" plus qu'on ne dépense).
 *
 * @param {number} categoryMonthlySpend
 * @param {number} amountReduced - montant en MGA que l'on souhaite retrancher / mois
 * @param {number} currentMonthlySavings
 */
export function simulateCategoryReductionByAmount(categoryMonthlySpend, amountReduced, currentMonthlySavings) {
  const monthlySaved = Math.min(Math.max(amountReduced, 0), categoryMonthlySpend);
  return {
    monthlySaved,
    annualSaved: monthlySaved * 12,
    newMonthlySavings: currentMonthlySavings + monthlySaved,
    newCategorySpend: categoryMonthlySpend - monthlySaved,
    impliedPct: categoryMonthlySpend > 0 ? (monthlySaved / categoryMonthlySpend) * 100 : 0,
  };
}

/**
 * Simule l'effet combiné d'une réduction sur PLUSIEURS catégories à la fois.
 * Chaque entrée peut définir sa réduction soit en % (`pct`) soit en montant
 * MGA direct (`amount`) — `amount` est prioritaire si les deux sont fournis.
 *
 * @param {Array<{name: string, spend: number, pct?: number, amount?: number}>} entries
 * @param {number} currentMonthlySavings
 */
export function simulateMultiCategoryReduction(entries, currentMonthlySavings) {
  const perCategory = entries.map((entry) => {
    const monthlySaved =
      entry.amount != null
        ? Math.min(Math.max(entry.amount, 0), entry.spend)
        : entry.spend * ((entry.pct || 0) / 100);
    return {
      name: entry.name,
      spend: entry.spend,
      monthlySaved,
      newCategorySpend: entry.spend - monthlySaved,
    };
  });

  const monthlySaved = perCategory.reduce((sum, c) => sum + c.monthlySaved, 0);

  return {
    perCategory,
    monthlySaved,
    annualSaved: monthlySaved * 12,
    newMonthlySavings: currentMonthlySavings + monthlySaved,
  };
}

/**
 * Simule une trajectoire d'épargne : montant à chaque mois, en partant d'un
 * montant de départ et en ajoutant une contribution mensuelle constante.
 *
 * @returns {{month: number, amount: number}[]} de 0 (aujourd'hui) à `months`
 */
export function simulateSavingsPlan(startAmount, monthlyContribution, months) {
  return Array.from({ length: months + 1 }, (_, i) => ({
    month: i,
    amount: startAmount + monthlyContribution * i,
  }));
}

/**
 * Simule une trajectoire d'épargne PROGRESSIVE : la contribution mensuelle
 * augmente d'un montant fixe (`monthlyIncrement`) chaque mois, à partir
 * d'une contribution de départ (`startContribution`).
 *
 * Mois 1 : startContribution
 * Mois 2 : startContribution + monthlyIncrement
 * Mois n : startContribution + (n-1) * monthlyIncrement
 *
 * @returns {{month: number, amount: number, contribution: number}[]}
 */
export function simulateProgressiveSavingsPlan(startAmount, startContribution, monthlyIncrement, months) {
  let amount = startAmount;
  const trajectory = [{ month: 0, amount, contribution: 0 }];
  for (let i = 1; i <= months; i++) {
    const contribution = Math.max(0, startContribution + monthlyIncrement * (i - 1));
    amount += contribution;
    trajectory.push({ month: i, amount, contribution });
  }
  return trajectory;
}

/**
 * Nombre de mois entiers entre deux dates (arrondi au mois supérieur),
 * utilisé pour convertir une "date cible" en nombre de mois d'épargne.
 *
 * @param {Date} from
 * @param {Date} targetDate
 * @returns {number} >= 0
 */
export function monthsBetween(from, targetDate) {
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

/**
 * Étant donné un objectif (montant restant) et une date cible, calcule la
 * contribution mensuelle constante nécessaire pour l'atteindre à temps.
 *
 * @param {number} remainingAmount
 * @param {Date} from
 * @param {Date} targetDate
 * @returns {{months: number, requiredMonthly: number}}
 */
export function requiredMonthlyForTargetDate(remainingAmount, from, targetDate) {
  const months = monthsBetween(from, targetDate);
  if (months <= 0) return { months: 0, requiredMonthly: remainingAmount };
  return { months, requiredMonthly: remainingAmount / months };
}

/**
 * Variante progressive : étant donné un objectif, une date cible et une
 * augmentation mensuelle fixée (`monthlyIncrement`), calcule la contribution
 * de départ nécessaire au 1er mois pour atteindre l'objectif pile à temps.
 *
 * Somme sur n mois de (start + increment*i) pour i=0..n-1 = remaining
 * => start = remaining/n - increment*(n-1)/2
 *
 * @returns {{months: number, requiredStartContribution: number}}
 */
export function requiredStartContributionForTargetDate(remainingAmount, from, targetDate, monthlyIncrement) {
  const months = monthsBetween(from, targetDate);
  if (months <= 0) return { months: 0, requiredStartContribution: remainingAmount };
  const requiredStartContribution = Math.max(
    0,
    remainingAmount / months - (monthlyIncrement * (months - 1)) / 2
  );
  return { months, requiredStartContribution };
}
