import { useState } from "react";
import {
  AlertTriangle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import KpiCard from "@/components/budget/KpiCard";
import ExpensePieChart from "@/components/budget/ExpensePieChart";
import BudgetVsActualChart from "@/components/budget/BudgetVsActualChart";
import { KpiSkeleton } from "@/components/Skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialStats } from "@/hooks/useFinancialStats";
import { getChartColor } from "@/lib/chartColors";
import { MONTHS_FULL, formatMGA } from "@/lib/budgetCategories";

export default function Dashboard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const {
    loading,
    kpis,
    previousKpis,
    variations,
    soldeTempsReel,
    periodTx,
    depensesParCategorie,
    budgetMensuel,
    alertesBudget,
    forecast,
  } = useFinancialStats({ month, year });

  function goToPrevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const prevMonthLabel = MONTHS_FULL[month === 1 ? 11 : month - 2];
  const nextMonthLabel = MONTHS_FULL[month === 12 ? 0 : month];
  const tauxDeltaPts = kpis.taux - previousKpis.taux;

  /** Couleur de puce alignée sur celle de la même catégorie dans le camembert,
      pour repérer une transaction d'un coup d'œil (dépenses uniquement). */
  function transactionDotColor(t) {
    const i = depensesParCategorie.findIndex((d) => d.name === t.category);
    return i >= 0 ? getChartColor(i) : "hsl(var(--muted-foreground))";
  }

  const dernieresTransactions = [...periodTx]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-6">
        <div>
          <Skeleton className="h-7 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <KpiSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            {MONTHS_FULL[month - 1]} {year}
          </p>
          <h1 className="text-3xl font-heading font-semibold tracking-tight">Tableau de bord</h1>
        </div>

        {/* Navigateur de mois façon pilules, avec précédent/suivant en un clic */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevMonth}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/70 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {prevMonthLabel}
          </button>
          <span className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-warm-sm">
            {MONTHS_FULL[month - 1]} {year}
          </span>
          <button
            type="button"
            onClick={goToNextMonth}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/15 transition-colors"
          >
            {nextMonthLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {alertesBudget.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/25 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-destructive">
              {alertesBudget.length} catégorie{alertesBudget.length > 1 ? "s" : ""} en dépassement de budget
            </p>
            <p className="text-xs text-destructive/75 mt-0.5">
              {alertesBudget.map((a) => a.category).join(" · ")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 stagger-in">
        <KpiCard
          index={0}
          label="Solde total"
          value={soldeTempsReel}
          format={formatMGA}
          dark
          variation={variations.revenus}
        />
        <KpiCard
          index={1}
          label="Total des dépenses"
          value={kpis.depenses}
          format={formatMGA}
          tone="danger"
          variation={variations.depenses}
          invertVariationColor
        />
        <KpiCard
          index={2}
          label="Épargne globale"
          value={kpis.epargne}
          format={formatMGA}
          tone={kpis.epargne >= 0 ? "success" : "danger"}
          variation={variations.epargne}
        />
        <KpiCard
          index={3}
          label="Taux d'épargne"
          value={kpis.taux}
          format={(n) => `${n.toFixed(1)} %`}
          tone="success"
          variation={tauxDeltaPts}
          variationLabel="pts vs mois préc."
        />
        <KpiCard index={4} label="Reste à vivre" value={kpis.reste} format={formatMGA} tone="accent" />
      </div>

      {forecast.finDeMoisDepenses !== null && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-warm-sm flex items-center gap-3">
          <span className="h-9 w-9 rounded-xl bg-warning/15 text-warning flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4" />
          </span>
          <p className="text-sm">
            Au rythme actuel, vos dépenses de {MONTHS_FULL[month - 1]} devraient atteindre environ{" "}
            <span className="font-figure font-semibold">{formatMGA(forecast.finDeMoisDepenses)}</span> en fin de mois.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-warm-sm">
          <h2 className="font-heading font-semibold tracking-tight">Répartition des dépenses</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {MONTHS_FULL[month - 1]} {year} · par catégorie
          </p>
          <ExpensePieChart data={depensesParCategorie} />
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 shadow-warm-sm">
          <h2 className="font-heading font-semibold tracking-tight">Budget prévu vs réel</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Janvier — {MONTHS_FULL[month - 1]} {year}
          </p>
          <BudgetVsActualChart data={budgetMensuel.data} showDepassements={false} />

          {/* Trois indicateurs de synthèse sous la courbe, comme repères rapides. */}
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Économies ce mois</p>
              <p className="font-figure font-semibold mt-0.5">
                {budgetMensuel.economieCeMois >= 0 ? "" : "-"}
                {formatMGA(Math.abs(budgetMensuel.economieCeMois))}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  budgetMensuel.economieCeMois >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {budgetMensuel.economieCeMois === 0
                  ? "prévu = réel"
                  : budgetMensuel.economieCeMois > 0
                    ? "sous le budget"
                    : "au-dessus du budget"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Meilleur mois</p>
              <p className="font-figure font-semibold mt-0.5">{budgetMensuel.meilleurMois?.name ?? "—"}</p>
              {budgetMensuel.meilleurMois && (
                <p className="text-xs text-success mt-0.5">
                  -{formatMGA(budgetMensuel.meilleurMois.ecart)} sous budget
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Dépassements</p>
              <p className="font-figure font-semibold mt-0.5">
                {budgetMensuel.moisEnDepassement.length} mois
              </p>
              {budgetMensuel.moisEnDepassement.length > 0 && (
                <p className="text-xs text-destructive mt-0.5">
                  {budgetMensuel.moisEnDepassement.join(" & ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dernières transactions de la période affichée */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-warm-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-heading font-semibold tracking-tight">Dernières transactions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {MONTHS_FULL[month - 1]} {year} · {periodTx.length} opération{periodTx.length > 1 ? "s" : ""}
            </p>
          </div>
          <Link
            to="/transactions"
            className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Voir tout <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {dernieresTransactions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Aucune transaction ce mois-ci</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
            {dernieresTransactions.map((t) => (
              <div key={t.id} className="flex items-start gap-2.5 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: transactionDotColor(t) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{t.description}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {t.category} · {new Date(t.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  </p>
                </div>
                <span
                  className={`font-figure text-sm font-medium shrink-0 ${
                    t.type === "Revenu" ? "text-success" : "text-destructive"
                  }`}
                >
                  {t.type === "Revenu" ? "+" : "-"}
                  {formatMGA(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bouton d'aide flottant — même destination que "Aide et support" dans
          le menu du compte (services/mailto vers le support). */}
      <a
        href="mailto:support@kasaina.mg?subject=Besoin%20d'aide%20-%20Budget-mg"
        title="Aide"
        aria-label="Aide"
        className="hidden md:flex fixed bottom-6 right-6 z-20 h-11 w-11 rounded-full bg-foreground text-background items-center justify-center shadow-warm-lg hover:opacity-90 transition-opacity"
      >
        <HelpCircle className="h-5 w-5" />
      </a>
    </div>
  );
}
