import { useMemo } from "react";

/** Nombre minimum de fois qu'une description doit avoir été saisie avant
 * qu'on ose la suggérer automatiquement. Évite de proposer une suggestion
 * sur un simple coup de chance après une seule saisie. */
const MIN_OCCURRENCES = 2;

function normalize(str) {
  return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Retourne la valeur la plus fréquente d'une Map "valeur -> nombre d'occurrences". */
function mostFrequent(counts) {
  let best = null;
  let bestCount = -1;
  for (const [value, count] of counts.entries()) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Construit, à partir de l'historique complet des transactions, un index des
 * descriptions déjà saisies : pour chaque description normalisée, retient la
 * catégorie et le type les plus fréquents, ainsi que le dernier montant utilisé.
 *
 * Expose `getSuggestion(texteEnCoursDeSaisie)` qui retrouve, pendant la frappe,
 * la description connue la plus probable (correspondance exacte ou par préfixe)
 * pour proposer une auto-complétion façon "Gmail Smart Compose".
 */
export function useTransactionSuggestion(allTransactions) {
  const index = useMemo(() => {
    const map = new Map();
    for (const t of allTransactions || []) {
      const key = normalize(t.description);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          // On garde la casse "propre" de la toute première occurrence rencontrée.
          text: t.description.trim(),
          count: 0,
          categories: new Map(),
          types: new Map(),
          lastAmount: null,
        });
      }
      const entry = map.get(key);
      entry.count += 1;
      entry.categories.set(t.category, (entry.categories.get(t.category) || 0) + 1);
      entry.types.set(t.type, (entry.types.get(t.type) || 0) + 1);
      entry.lastAmount = t.amount; // les transactions arrivent triées, la plus récente écrase
    }

    const resolved = new Map();
    for (const [key, entry] of map.entries()) {
      if (entry.count < MIN_OCCURRENCES) continue;
      resolved.set(key, {
        text: entry.text,
        category: mostFrequent(entry.categories),
        type: mostFrequent(entry.types),
        amount: entry.lastAmount,
        count: entry.count,
      });
    }
    return resolved;
  }, [allTransactions]);

  /**
   * Cherche la meilleure suggestion pour le texte actuellement tapé.
   * - correspondance exacte -> suggestion sans "suffixe" à compléter
   * - correspondance par préfixe -> propose la fin du mot (la plus fréquente)
   * Retourne null si rien de pertinent ou si le texte est vide.
   */
  function getSuggestion(inputText) {
    const key = normalize(inputText);
    if (!key) return null;

    const exact = index.get(key);
    if (exact) return { ...exact, suffix: "" };

    let best = null;
    for (const [normKey, entry] of index.entries()) {
      if (normKey.startsWith(key) && normKey.length > key.length) {
        if (!best || entry.count > best.count) best = entry;
      }
    }
    if (!best) return null;
    return { ...best, suffix: best.text.slice(inputText.length) };
  }

  return { getSuggestion };
}
