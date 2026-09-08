import { useRef, useState } from "react";
import { Plus, Check, X, CornerDownLeft } from "lucide-react";
import { ALL_CATEGORIES, formatMGA } from "@/lib/budgetCategories";
import ReceiptScanner from "@/components/transactions/ReceiptScanner";
import AmountCalculator from "@/components/transactions/AmountCalculator";

/** Champs du formulaire, réutilisés à l'identique dans la carte desktop et la feuille mobile. */
export default function TransactionFormFields({
  form,
  setForm,
  handleCategoryChange,
  handleTypeChange,
  editingId,
  cancelEdit,
  saving,
  layout,
  onScanImport,
  getSuggestion,
}) {
  const isAutres = form.category === "Autres";
  const amountInputRef = useRef(null);
  const [descFocused, setDescFocused] = useState(false);

  // Pas de suggestion pendant l'édition d'une transaction existante : on ne
  // veut pas ré-écraser une description/catégorie déjà choisie volontairement.
  const suggestion = !editingId && getSuggestion ? getSuggestion(form.description) : null;
  const alreadyApplied =
    !!suggestion && form.description === suggestion.text && form.category === suggestion.category;

  function applySuggestion() {
    if (!suggestion) return;
    setForm((f) => ({
      ...f,
      description: suggestion.text,
      // On ne pré-remplit le montant que si le champ est encore vide, pour ne
      // jamais écraser une valeur que l'utilisateur aurait déjà tapée.
      amount: f.amount || (suggestion.amount != null ? String(suggestion.amount) : f.amount),
    }));
    handleCategoryChange(suggestion.category);
    if (isAutres || suggestion.category === "Autres") {
      handleTypeChange(suggestion.type || "Dépense");
    }
    // Focus + sélection du montant : l'utilisateur peut juste appuyer sur
    // Entrée pour valider, ou taper directement pour corriger la valeur.
    requestAnimationFrame(() => {
      amountInputRef.current?.focus();
      amountInputRef.current?.select();
    });
  }

  function handleDescriptionKeyDown(e) {
    if (!suggestion || alreadyApplied) return;
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      applySuggestion();
    }
  }

  return (
    <>
      <div className={layout === "sheet" ? "" : "lg:col-span-1"}>
        <label className="text-xs font-medium text-muted-foreground">Date</label>
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>
      <div className={layout === "sheet" ? "" : "lg:col-span-2"}>
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        {/* La bordure/fond visibles vivent sur ce conteneur : le champ texte
            lui-même est transparent pour laisser transparaître, derrière lui,
            la fin suggérée en grisé (façon Gmail Smart Compose). */}
        <div className="relative mt-1 rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
          {suggestion?.suffix && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 flex items-center overflow-hidden whitespace-pre px-3 py-2.5 text-sm"
            >
              <span className="invisible">{form.description}</span>
              <span className="text-muted-foreground/50">{suggestion.suffix}</span>
            </div>
          )}
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            onKeyDown={handleDescriptionKeyDown}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            placeholder="Ex : Courses Jumbo Score"
            autoComplete="off"
            className="relative z-10 w-full rounded-xl bg-transparent px-3 py-2.5 text-sm focus:outline-none"
            required
          />
        </div>
        {/* Repère explicite (catégorie + montant proposés) — cliquable pour
            les écrans tactiles où la touche Entrée n'est pas toujours fiable. */}
        {suggestion && !alreadyApplied && descFocused && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()} // évite de voler le focus avant le clic
            onClick={applySuggestion}
            className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <CornerDownLeft className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {suggestion.suffix ? "Compléter" : "Appliquer"} · {suggestion.category}
              {suggestion.amount != null ? ` · ${formatMGA(suggestion.amount)}` : ""}
            </span>
          </button>
        )}
      </div>
      <div className={layout === "sheet" ? "" : "lg:col-span-1"}>
        <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
        <select
          value={form.category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ALL_CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {/* "Autres" peut être aussi bien un revenu qu'une dépense (petite rentrée
          imprévue, achat divers…) : on laisse l'utilisateur préciser lui-même,
          plutôt que de forcer "Revenu" par défaut. */}
      {isAutres && (
        <div className={layout === "sheet" ? "" : "lg:col-span-1"}>
          <label className="text-xs font-medium text-muted-foreground">C'est un…</label>
          <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => handleTypeChange("Revenu")}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                form.type === "Revenu"
                  ? "bg-success text-success-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Revenu
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("Dépense")}
              className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                form.type === "Dépense"
                  ? "bg-destructive text-destructive-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              Dépense
            </button>
          </div>
        </div>
      )}
      <div className={layout === "sheet" ? "" : "lg:col-span-1"}>
        <label className="text-xs font-medium text-muted-foreground">Montant (MGA)</label>
        <div className={`mt-1 flex gap-1.5 ${layout === "sheet" ? "gap-2" : ""}`}>
          <input
            ref={amountInputRef}
            type="number"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder="0"
            className={`w-full rounded-xl border border-border bg-background text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring ${
              layout === "sheet" ? "px-3.5 py-3 text-base" : "px-3 py-2.5 text-sm"
            }`}
            required
          />
          <AmountCalculator
            className={
              layout === "sheet" ? "shrink-0 h-[48px] w-[48px]" : "shrink-0 h-[42px] w-[42px]"
            }
            onApply={(value) => setForm((f) => ({ ...f, amount: value }))}
          />
        </div>
      </div>
      <div className={layout === "sheet" ? "flex gap-2 pt-2" : "lg:col-span-1 flex gap-2"}>
        {/* Scan IA du reçu — uniquement en mode ajout, pas en édition. Chaque
            article détecté devient sa propre transaction (voir ReceiptScanner.jsx
            + Transactions.jsx:handleScanImport), plutôt que de préremplir ce
            formulaire avec un total agrégé. Icône seule, même gabarit que le
            bouton calculatrice à côté du montant, pour rester discret à côté
            du bouton "Ajouter". */}
        {!editingId && (
          <ReceiptScanner
            onScanSuccess={onScanImport}
            className={layout === "sheet" ? "h-[46px] w-[46px]" : "h-[42px] w-[42px]"}
          />
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium px-3 py-2.5 hover:bg-primary/90 disabled:opacity-50"
        >
          {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {editingId ? "Enregistrer" : "Ajouter"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={cancelEdit}
            className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2.5 hover:bg-muted touch-target"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </>
  );
}
