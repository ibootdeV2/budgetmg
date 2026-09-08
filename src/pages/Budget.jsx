import { useState } from "react";
import { ChevronLeft, ChevronRight, Wallet, TrendingDown, PiggyBank, CopyPlus, Rows3, CalendarDays, Info } from "lucide-react";
import { useAnnualBudgetStats } from "@/hooks/useAnnualBudgetStats";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import KpiCard from "@/components/budget/KpiCard";
import ApplyToMonthsPopover from "@/components/budget/ApplyToMonthsPopover";
import CategoryMonthsEditor from "@/components/budget/CategoryMonthsEditor";
import { TableSkeleton, KpiSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CATEGORY_GROUPS,
  ALL_CATEGORIES,
  MONTHS,
  formatMGA,
} from "@/lib/budgetCategories";

const YEARS = [2025, 2026, 2027];

/**
 * Sélecteur de mois pour la vue mobile "par mois" : le tableau à 12 colonnes
 * n'est pas exploitable sur petit écran (défilement horizontal peu lisible),
 * donc on affiche un mois à la fois, avec navigation précédent/suivant.
 */
function MonthSwitcher({ month, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(month === 1 ? 12 : month - 1)}
        aria-label="Mois précédent"
        className="touch-target p-2.5 rounded-xl border border-border bg-card hover:bg-muted shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <select
        value={month}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Sélectionner le mois du budget"
        className="flex-1 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-center font-medium focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onChange(month === 12 ? 1 : month + 1)}
        aria-label="Mois suivant"
        className="touch-target p-2.5 rounded-xl border border-border bg-card hover:bg-muted shrink-0"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Bascule "Par mois" (12 catégories d'un mois) / "Par catégorie" (12 mois d'une catégorie). */
function MobileModeToggle({ mode, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted/50 p-1">
      {[
        { id: "month", label: "Par mois", icon: CalendarDays },
        { id: "category", label: "Par catégorie", icon: Rows3 },
      ].map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
            mode === id ? "bg-card shadow-warm-sm text-foreground" : "text-muted-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Squelette de chargement pour les cartes de la vue mobile. */
function MobileBudgetSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-card rounded-2xl border border-border p-4 shadow-warm-sm space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export default function Budget() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [mobileMonth, setMobileMonth] = useState(now.getMonth() + 1);
  const [mobileMode, setMobileMode] = useState("month");
  const [mobileCategory, setMobileCategory] = useState(ALL_CATEGORIES[0].name);
  const [confirmCopyOpen, setConfirmCopyOpen] = useState(false);

  const {
    loading,
    getValue,
    setValue,
    applyToMonths,
    copyFromYear,
    rowTotal,
    totalRevenusPrevu,
    totalDepensesPrevu,
    epargnePrevue,
    pctDepensesEngagees,
    isCurrentYear,
    pctAnneeEcoulee,
  } = useAnnualBudgetStats({ year });
  const { toast } = useToast();

  function updateCell(cat, month, value) {
    setValue(cat, month, value);
  }

  function applyRow(cat, amount, months) {
    applyToMonths(cat, amount, months);
    const label = months.length === 12 ? "toute l'année" : `${months.length} mois`;
    toast({ title: "Budget mis à jour", description: `${cat} · ${formatMGA(amount)} appliqué sur ${label}` });
  }

  function handleCopyPreviousYear() {
    const copied = copyFromYear(year - 1);
    setConfirmCopyOpen(false);
    if (copied === 0) {
      toast({
        title: "Rien à copier",
        description: `Aucun budget trouvé pour ${year - 1}.`,
        variant: "destructive",
      });
    } else {
      toast({ title: "Budget copié", description: `${year - 1} → ${year} (${copied} lignes reprises)` });
    }
  }

  const groupTotal = (group, month) => group.categories.reduce((s, c) => s + getValue(c, month), 0);
  const groupAnnual = (group) => group.categories.reduce((s, c) => s + rowTotal(c), 0);
  const monthGrandTotal = (month) => CATEGORY_GROUPS.reduce((s, g) => s + groupTotal(g, month), 0);

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Prévisionnel</p>
          <h1 className="text-3xl font-heading font-semibold tracking-tight">Budget annuel</h1>
          <p className="text-sm text-muted-foreground">
            Indiquez ici combien vous prévoyez de dépenser (ou de gagner) chaque mois, par catégorie
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmCopyOpen(true)}
            title={`Reprend automatiquement les montants prévus en ${year - 1}, pour gagner du temps`}
            className="touch-target inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
          >
            <CopyPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Copier</span> {year - 1}
          </button>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger aria-label="Sélectionner l'année du budget" className="w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCopyOpen}
        onOpenChange={setConfirmCopyOpen}
        title={`Copier le budget de ${year - 1} ?`}
        description={`Les montants déjà saisis pour ${year} seront remplacés par ceux de ${year - 1}, catégorie par catégorie et mois par mois.`}
        confirmLabel="Copier"
        variant="default"
        onConfirm={handleCopyPreviousYear}
      />

      {/* --- Explication en langage simple, pour un premier usage --- */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
        <span className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Info className="h-4 w-4" />
        </span>
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">Comment ça marche : </span>
          pour chaque catégorie (Alimentation, Loyer, etc.), saisissez le montant que vous comptez dépenser
          ce mois-là. C'est votre <span className="text-foreground font-medium">budget prévu</span>. Vos
          dépenses réelles (dans l'onglet Transactions) seront ensuite comparées à ce montant pour voir si
          vous êtes dans les clous.
        </p>
      </div>

      {/* --- Résumé annuel --- */}
      {loading ? (
        <KpiSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label={`Revenus prévus ${year}`} value={totalRevenusPrevu} format={formatMGA} icon={Wallet} tone="primary" />
          <KpiCard label={`Dépenses prévues ${year}`} value={totalDepensesPrevu} format={formatMGA} icon={TrendingDown} tone="danger" />
          <KpiCard
            label={`Épargne prévue ${year}`}
            value={epargnePrevue}
            format={formatMGA}
            icon={PiggyBank}
            tone={epargnePrevue >= 0 ? "success" : "danger"}
          />
        </div>
      )}

      {!loading && isCurrentYear && pctDepensesEngagees !== null && (
        <div className="bg-card rounded-2xl border border-border shadow-warm-sm p-4">
          <p className="text-xs text-muted-foreground mb-3">
            Ce repère compare où vous en êtes dans l'année à ce que vous avez déjà dépensé de votre budget.
          </p>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">{pctAnneeEcoulee}&nbsp;% de l'année {year} est passée</span>
            <span className="font-figure font-medium">
              {pctDepensesEngagees}&nbsp;% du budget dépenses déjà dépensé
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-muted-foreground/30" style={{ width: `${pctAnneeEcoulee}%` }} />
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden mt-1.5">
            <div
              className={`h-full ${pctDepensesEngagees > pctAnneeEcoulee ? "bg-destructive" : "bg-success"}`}
              style={{ width: `${Math.min(100, pctDepensesEngagees)}%` }}
            />
          </div>
          {pctDepensesEngagees > pctAnneeEcoulee && (
            <p className="text-xs text-destructive mt-2">
              Vous dépensez plus vite que ce que l'année n'avance — à surveiller.
            </p>
          )}
        </div>
      )}

      {/* --- Vue mobile --- */}
      <div className="md:hidden space-y-4">
        <MobileModeToggle mode={mobileMode} onChange={setMobileMode} />

        {loading ? (
          <MobileBudgetSkeleton />
        ) : mobileMode === "category" ? (
          <CategoryMonthsEditor
            category={mobileCategory}
            onCategoryChange={setMobileCategory}
            getValue={getValue}
            onChangeMonth={updateCell}
            onApplyToMonths={applyRow}
            rowTotal={rowTotal}
            currentMonth={now.getMonth() + 1}
          />
        ) : (
          <>
            <MonthSwitcher month={mobileMonth} onChange={setMobileMonth} />

            {CATEGORY_GROUPS.map((g) => (
              <div key={g.group} className="bg-card rounded-2xl border border-border shadow-warm-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/30 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {g.group}
                  </span>
                  <span className="font-figure text-xs font-medium text-muted-foreground">
                    {formatMGA(groupTotal(g, mobileMonth))}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {g.categories.map((cat) => {
                    const value = getValue(cat, mobileMonth);
                    return (
                      <div key={cat} className="px-4 py-3 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cat}</p>
                          <p className="font-figure text-[11px] text-muted-foreground mt-0.5">
                            Total annuel {formatMGA(rowTotal(cat))}
                          </p>
                        </div>
                        <input
                          type="number"
                          inputMode="decimal"
                          // La clé inclut le mois et la valeur : si la valeur change ailleurs
                          // (sync cloud) ou qu'on change de mois, le champ se remonte avec
                          // la bonne valeur par défaut plutôt que de garder l'ancienne saisie.
                          key={`${cat}-${mobileMonth}-${value}`}
                          defaultValue={value}
                          onBlur={(e) => updateCell(cat, mobileMonth, e.target.value)}
                          aria-label={`Montant prévu pour ${cat}, ${MONTHS[mobileMonth - 1]}`}
                          className="font-figure w-28 shrink-0 bg-background text-right px-3 py-2.5 rounded-xl border border-border focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <ApplyToMonthsPopover
                          category={cat}
                          currentMonth={mobileMonth}
                          defaultAmount={value || ""}
                          onApply={(amount, months) => applyRow(cat, amount, months)}
                          triggerClassName="touch-target p-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3.5 flex items-center justify-between">
              <p className="text-sm font-medium">Total {MONTHS[mobileMonth - 1]}</p>
              <p className="font-figure text-sm font-semibold">{formatMGA(monthGrandTotal(mobileMonth))}</p>
            </div>
          </>
        )}
      </div>

      {/* --- Vue desktop : tableau complet des 12 mois --- */}
      <p className="hidden md:block text-xs text-muted-foreground">
        Cliquez dans une case pour saisir ou modifier le montant prévu de ce mois-là.
      </p>
      <div className="hidden md:block bg-card rounded-2xl border border-border shadow-warm-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3 sticky left-0 bg-muted/50 z-10 min-w-[200px]">
                  Catégorie
                </th>
                {MONTHS.map((m) => (
                  <th key={m} className="text-right font-medium px-3 py-3 min-w-[88px]">
                    {m}
                  </th>
                ))}
                <th className="text-right font-medium px-4 py-3 min-w-[120px]">Total annuel</th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            {loading ? (
              <tbody>
                <TableSkeleton rows={8} columns={15} />
              </tbody>
            ) : (
              CATEGORY_GROUPS.map((g) => (
                <tbody key={g.group}>
                  <tr className="bg-muted/30">
                    <td
                      colSpan={15}
                      className="px-4 py-2 font-medium text-xs uppercase tracking-wide text-muted-foreground sticky left-0 bg-muted/30 z-10"
                    >
                      {g.group}
                    </td>
                  </tr>
                  {g.categories.map((cat) => (
                    <tr key={cat} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-1.5 sticky left-0 bg-card z-10 font-medium">{cat}</td>
                      {MONTHS.map((_, i) => {
                        const m = i + 1;
                        const value = getValue(cat, m);
                        return (
                          <td key={m} className="px-1 py-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              // La clé inclut la valeur : si elle change ailleurs (sync cloud),
                              // React remonte le champ avec la bonne valeur par défaut.
                              key={`${cat}-${m}-${value}`}
                              defaultValue={value}
                              onBlur={(e) => updateCell(cat, m, e.target.value)}
                              aria-label={`Montant prévu pour ${cat}, ${MONTHS[i]} ${year}`}
                              className="font-figure w-full bg-transparent text-right px-2 py-1.5 rounded-lg border border-transparent hover:border-border focus:border-ring focus:bg-card focus:outline-none"
                            />
                          </td>
                        );
                      })}
                      <td className="font-figure px-4 py-1.5 text-right font-medium">{formatMGA(rowTotal(cat))}</td>
                      <td className="px-2 py-1.5 text-center">
                        <ApplyToMonthsPopover
                          category={cat}
                          currentMonth={now.getMonth() + 1}
                          defaultAmount={getValue(cat, 1) || ""}
                          onApply={(amount, months) => applyRow(cat, amount, months)}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/20 border-t border-border">
                    <td className="px-4 py-2 sticky left-0 bg-muted/20 z-10 text-xs font-medium text-muted-foreground">
                      Sous-total {g.group}
                    </td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className="font-figure px-3 py-2 text-right text-xs text-muted-foreground">
                        {Math.round(groupTotal(g, i + 1) / 1000)}k
                      </td>
                    ))}
                    <td className="font-figure px-4 py-2 text-right font-medium">{formatMGA(groupAnnual(g))}</td>
                    <td></td>
                  </tr>
                </tbody>
              ))
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
