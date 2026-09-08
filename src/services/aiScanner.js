// ============================================================================
// services/aiScanner.js
// Service client pour le "Scan & Optimisation IA" des reçus/factures.
// Convertit le fichier en Base64 et délègue l'analyse à l'Edge Function
// Supabase `scan-receipt`, qui appelle le modèle IA vision côté serveur
// (la clé API n'est jamais exposée au client).
// ============================================================================

import { supabase } from "@/services/supabase";
import { ALL_CATEGORIES } from "@/lib/budgetCategories";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export class ScanReceiptError extends Error {}

/** Vérifie le type et la taille du fichier avant tout appel réseau. */
export function validateReceiptFile(file) {
  if (!file) throw new ScanReceiptError("Aucun fichier sélectionné.");
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ScanReceiptError("Format non supporté. Utilisez une image (JPG, PNG, WebP) ou un PDF.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new ScanReceiptError("Fichier trop volumineux (10 Mo maximum).");
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new ScanReceiptError("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** Sécurise/normalise UNE ligne d'article avant de l'ajouter comme transaction
 * — on ne fait jamais confiance aveuglément à un JSON généré par un modèle. */
function normalizeItem(raw, date) {
  const matchedCategory = ALL_CATEGORIES.find((c) => c.name === raw?.category);
  const amount = Number(raw?.amount);

  return {
    title: typeof raw?.title === "string" && raw.title.trim() ? raw.title.trim() : "Article scanné",
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    date,
    category: matchedCategory ? matchedCategory.name : "Autres",
    type:
      raw?.type === "income"
        ? "Revenu"
        : raw?.type === "expense"
          ? "Dépense"
          : matchedCategory?.type || "Dépense",
  };
}

/** Normalise la réponse complète de l'Edge Function : une date de reçu +
 * un tableau d'articles, chacun devenant sa propre transaction. */
function normalizeScanResult(raw) {
  const date = isValidDate(raw?.date) ? raw.date : new Date().toISOString().slice(0, 10);
  const rawItems = Array.isArray(raw?.items) && raw.items.length ? raw.items : [raw];

  return rawItems.map((item) => normalizeItem(item, date)).filter((item) => item.amount > 0);
}

/**
 * Envoie un reçu/facture (image ou PDF) à l'Edge Function `scan-receipt`.
 * Retourne un TABLEAU d'objets { title, amount, date, category, type }, un
 * par article/ligne détecté sur le reçu — prêt à être ajouté comme autant
 * de transactions distinctes (voir ReceiptScanner.jsx pour la revue/édition).
 */
export async function scanReceipt(file) {
  validateReceiptFile(file);

  const fileBase64 = await fileToBase64(file);
  const categories = ALL_CATEGORIES.map((c) => ({ name: c.name, type: c.type }));

  const { data, error } = await supabase.functions.invoke("scan-receipt", {
    body: { fileBase64, mediaType: file.type, categories },
  });

  if (error) {
    throw new ScanReceiptError(error.message || "Le service de scan est momentanément indisponible.");
  }
  if (!data || data.error) {
    throw new ScanReceiptError(data?.error || "L'IA n'a pas pu analyser ce reçu.");
  }

  const items = normalizeScanResult(data);
  if (!items.length) {
    throw new ScanReceiptError("Aucun article exploitable n'a été trouvé sur ce reçu.");
  }
  return items;
}
