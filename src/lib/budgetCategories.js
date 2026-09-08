export const CATEGORY_GROUPS = [
  {
    group: "Revenus",
    type: "Revenu",
    categories: ["Salaire", "Freelance / Side Hustle", "Investissements", "Autres"],
  },
  {
    group: "Dépenses fixes",
    type: "Dépense",
    categories: [
      "Logement / Loyer",
      "Factures (Eau, Électricité, Internet,...)",
      "Assurances",
      "Abonnements",
    ],
  },
  {
    group: "Dépenses variables",
    type: "Dépense",
    categories: ["Alimentation", "Transport", "Loisirs", "Shopping", "Santé"],
  },
  {
    group: "Épargne & Investissements",
    type: "Dépense",
    categories: ["Épargne de précaution", "Investissements (Bourse/Crypto)", "Retraite"],
  },
];

export const ALL_CATEGORIES = CATEGORY_GROUPS.flatMap((g) =>
  g.categories.map((name) => ({ name, group: g.group, type: g.type }))
);

export const SAVINGS_CATEGORIES = ALL_CATEGORIES.filter(
  (c) => c.group === "Épargne & Investissements"
).map((c) => c.name);

export const MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

// Noms complets, utilisés partout où l'espace ne manque pas (en-têtes, sélecteurs, phrases).
export const MONTHS_FULL = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function getCategoryGroup(name) {
  return ALL_CATEGORIES.find((c) => c.name === name)?.group || "";
}

export function getCategoryType(name) {
  return ALL_CATEGORIES.find((c) => c.name === name)?.type || "Dépense";
}

export function formatMGA(amount) {
  const n = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Math.round(Number(amount) || 0)
  );
  return `${n} MGA`;
}