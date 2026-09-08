// ============================================================================
// lib/importExcel.js
// Import de transactions depuis un fichier Excel (.xlsx/.xls) ou CSV.
// ============================================================================
// Symétrique à lib/export.js : un fichier généré par exportTransactionsToExcel
// doit pouvoir être réimporté tel quel. On tolère des variantes raisonnables
// (en-têtes sans accents, montants non signés, colonnes en plus, catégories
// inconnues...) pour absorber des fichiers qui ne viennent pas forcément du
// dashboard lui-même (export bancaire, saisie manuelle...).
//
// Toute ligne — valide ou non — est conservée dans le résultat sous forme de
// "brouillon" (draft row) : l'UI peut ainsi afficher les lignes en erreur
// avec des champs éditables plutôt que de les rejeter silencieusement.
// L'utilisateur corrige, on revalide la ligne (buildDraftRow), et une fois
// sans erreur elle redevient importable.
// ============================================================================

import * as XLSX from "xlsx";
import { ALL_CATEGORIES, getCategoryType } from "@/lib/budgetCategories";

export const FALLBACK_CATEGORY = "Autres";

/** Normalise un texte : minuscule, sans accents, sans espaces superflus. */
function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents
    .trim()
    .toLowerCase();
}

/** Table de correspondance : variantes d'en-têtes acceptées -> champ interne. */
const HEADER_ALIASES = {
  date: "date",
  description: "description",
  libelle: "description",
  categorie: "category",
  category: "category",
  type: "type",
  montant: "amount",
  montantmga: "amount",
  amount: "amount",
};

function buildFieldMap(rawHeaders) {
  const map = {};
  for (const raw of rawHeaders) {
    const collapsed = normalizeText(raw).replace(/[^a-z0-9]/g, "");
    const alias = Object.entries(HEADER_ALIASES).find(
      ([k]) => k.replace(/[^a-z0-9]/g, "") === collapsed
    )?.[1];
    if (alias) map[raw] = alias;
  }
  return map;
}

/** Normalise une catégorie saisie librement vers une catégorie connue (comparaison insensible à la casse/accents). */
export function matchCategory(value) {
  if (!value) return null;
  const target = normalizeText(value);
  const found = ALL_CATEGORIES.find((c) => normalizeText(c.name) === target);
  return found ? found.name : null;
}

/** Parse une date au format Excel (numérique), Date JS, ISO, ou JJ/MM/AAAA. Retourne "AAAA-MM-JJ" ou null. */
export function parseDate(value) {
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0, 10);

  if (typeof value === "number") {
    // Numéro de série de date Excel (nombre de jours depuis 1899-12-30)
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return d.toISOString().slice(0, 10);
    }
    return null;
  }

  const str = String(value ?? "").trim();
  if (!str) return null;

  // JJ/MM/AAAA ou JJ-MM-AAAA
  const eu = str.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (eu) {
    const [, d, m, y] = eu;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isNaN(date) ? null : date.toISOString().slice(0, 10);
  }

  // ISO AAAA-MM-JJ (ou avec heure) — couvre aussi la valeur d'un <input type="date">
  const iso = new Date(str);
  return isNaN(iso) ? null : iso.toISOString().slice(0, 10);
}

/** Parse un montant : accepte nombres, espaces/séparateurs milliers, virgule décimale, symbole "MGA". */
export function parseAmount(value) {
  if (typeof value === "number") return value;
  const str = String(value ?? "")
    .replace(/[^\d,.\-]/g, "") // retire "MGA", espaces insécables, symboles
    .replace(/\s/g, "");
  if (!str) return NaN;
  // Si virgule utilisée comme décimale et pas de point, on la convertit
  const normalized = str.includes(",") && !str.includes(".") ? str.replace(",", ".") : str.replace(/,/g, "");
  return Number(normalized);
}

export function normalizeType(value, fallbackCategory) {
  const str = normalizeText(value);
  if (str.startsWith("revenu") || str === "income" || str === "credit") return "Revenu";
  if (str.startsWith("depense") || str === "expense" || str === "debit") return "Dépense";
  // Type absent/illisible : on le déduit de la catégorie si possible
  return fallbackCategory ? getCategoryType(fallbackCategory) : null;
}

/** Une ligne est totalement vide si tous ses champs bruts sont vides/null. */
function isBlankRow(fieldsRaw) {
  return Object.values(fieldsRaw).every((v) => v === null || v === undefined || String(v).trim() === "");
}

/**
 * Construit/valide une ligne à partir de ses valeurs brutes. Utilisé aussi bien lors
 * du parsing initial du fichier que lors de la revalidation après une édition manuelle
 * dans l'aperçu (l'UI rappelle cette fonction avec les champs corrigés).
 * @param {{date, description, category, type, amount}} fieldsRaw
 * @param {number} sourceRow - numéro de ligne Excel (pour affichage/référence uniquement)
 */
export function buildDraftRow(fieldsRaw, sourceRow) {
  const fieldErrors = {};

  const date = parseDate(fieldsRaw.date);
  if (!date) fieldErrors.date = "date invalide ou manquante";

  const description = String(fieldsRaw.description ?? "").trim();
  if (!description) fieldErrors.description = "description manquante";

  let category = matchCategory(fieldsRaw.category);
  const categoryWasFallback = !category;
  if (!category) category = FALLBACK_CATEGORY;

  const type = normalizeType(fieldsRaw.type, category) || "Dépense";

  let amount = parseAmount(fieldsRaw.amount);
  if (isNaN(amount)) {
    fieldErrors.amount = "montant invalide ou manquant";
  } else {
    // Toujours stocké en positif ; le signe est porté par `type` (cohérent avec le reste de l'app)
    amount = Math.abs(amount);
    if (amount === 0) fieldErrors.amount = "montant à zéro";
  }

  return {
    _sourceRow: sourceRow,
    raw: fieldsRaw,
    date,
    description,
    category,
    categoryWasFallback,
    originalCategoryRaw: fieldsRaw.category ? String(fieldsRaw.category) : null,
    type,
    amount,
    fieldErrors,
  };
}

export function rowHasErrors(row) {
  return Object.keys(row.fieldErrors).length > 0;
}

/**
 * Parse un fichier (File) Excel/CSV et retourne toutes les lignes sous forme de brouillons
 * (draft rows), y compris celles en erreur — à corriger dans l'UI avant import.
 * @param {File} file
 * @returns {Promise<{rows: Array, totalRows: number}>}
 */
export async function parseTransactionsFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const raw = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  if (raw.length === 0) return { rows: [], totalRows: 0 };

  const fieldMap = buildFieldMap(Object.keys(raw[0]));
  const rows = [];

  raw.forEach((record, idx) => {
    const excelRowNumber = idx + 2; // +1 pour l'en-tête, +1 pour l'index base 1
    const get = (field) => {
      const key = Object.keys(fieldMap).find((k) => fieldMap[k] === field);
      return key ? record[key] : undefined;
    };

    const fieldsRaw = {
      date: get("date"),
      description: get("description"),
      category: get("category"),
      type: get("type"),
      amount: get("amount"),
    };

    if (isBlankRow(fieldsRaw)) return; // ligne totalement vide : ignorée silencieusement

    rows.push(buildDraftRow(fieldsRaw, excelRowNumber));
  });

  return { rows, totalRows: raw.length };
}

/** Clé de comparaison utilisée pour détecter les doublons. */
function duplicateKey(row) {
  return `${row.date}|${String(row.description).trim().toLowerCase()}|${row.amount}`;
}

/** Est-ce que cette ligne correspond à une transaction déjà existante en base ? */
export function isDuplicate(row, existingTransactions) {
  if (row.fieldErrors?.date || row.fieldErrors?.amount) return false; // pas de clé fiable tant que la ligne est invalide
  const key = duplicateKey(row);
  return existingTransactions.some(
    (t) => `${t.date}|${t.description.trim().toLowerCase()}|${t.amount}` === key
  );
}

/** Marque chaque ligne d'un lot avec son statut de doublon (`_isDuplicate`). */
export function markDuplicates(rows, existingTransactions) {
  return rows.map((row) => ({ ...row, _isDuplicate: isDuplicate(row, existingTransactions) }));
}
