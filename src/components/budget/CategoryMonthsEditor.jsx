import ApplyToMonthsPopover from "@/components/budget/ApplyToMonthsPopover";
import { CATEGORY_GROUPS, MONTHS, formatMGA } from "@/lib/budgetCategories";

/**
 * Mode de saisie mobile alternatif : au lieu d'afficher un mois avec toutes
 * les catégories (MonthSwitcher), on affiche UNE catégorie avec ses 12 mois
 * d'un coup. Beaucoup plus rapide pour une catégorie dont le montant varie
 * (ex. Loisirs) : plus besoin de changer de mois 12 fois de suite.
 */
export default function CategoryMonthsEditor({
  category,
  onCategoryChange,
  getValue,
  onChangeMonth,
  onApplyToMonths,
  rowTotal,
  currentMonth,
}) {
  return (
    <div className="space-y-4">
      <select
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label="Choisir la catégorie à remplir"
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {CATEGORY_GROUPS.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="bg-card rounded-2xl border border-border shadow-warm-sm overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{category}</p>
            <p className="font-figure text-[11px] text-muted-foreground mt-0.5">
              Total annuel {formatMGA(rowTotal(category))}
            </p>
          </div>
          <ApplyToMonthsPopover
            category={category}
            currentMonth={currentMonth}
            defaultAmount={getValue(category, currentMonth) || ""}
            onApply={(amount, months) => onApplyToMonths(category, amount, months)}
            triggerClassName="touch-target shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          />
        </div>
        <div className="divide-y divide-border">
          {MONTHS.map((label, i) => {
            const m = i + 1;
            const value = getValue(category, m);
            return (
              <div key={m} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground w-10 shrink-0">{label}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  key={`${category}-${m}-${value}`}
                  defaultValue={value}
                  onBlur={(e) => onChangeMonth(category, m, e.target.value)}
                  aria-label={`Montant prévu pour ${category}, ${label}`}
                  className="font-figure flex-1 bg-background text-right px-3 py-2 rounded-xl border border-border focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
