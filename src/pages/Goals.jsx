import { useState } from "react";
import { useSavingsGoals } from "@/hooks/useSavingsGoals";
import { useFinancialStats } from "@/hooks/useFinancialStats";
import { Plus, Trash2, Target, PiggyBank, CalendarClock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeletons";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatMGA } from "@/lib/budgetCategories";
import { formatMonthYear, projectGoalDate } from "@/lib/projections";
import WhatIfSimulator from "@/components/goals/WhatIfSimulator";

const emptyForm = { name: "", target_amount: "", current_amount: "", monthly_contribution: "" };

/** Champs du formulaire, partagés entre la carte desktop et la feuille modale mobile. */
function GoalFormFields({ form, setForm, saving, stacked }) {
  return (
    <>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Nom de l'objectif</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Ex : Fonds d'urgence"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Montant cible (MGA)</label>
        <input
          type="number"
          inputMode="decimal"
          value={form.target_amount}
          onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))}
          placeholder="0"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>
      <div className={stacked ? "" : "flex gap-2"}>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground">Déjà épargné (MGA)</label>
          <input
            type="number"
            inputMode="decimal"
            value={form.current_amount}
            onChange={(e) => setForm((f) => ({ ...f, current_amount: e.target.value }))}
            placeholder="0"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Contribution mensuelle prévue (MGA, optionnel)</label>
        <input
          type="number"
          inputMode="decimal"
          value={form.monthly_contribution}
          onChange={(e) => setForm((f) => ({ ...f, monthly_contribution: e.target.value }))}
          placeholder="Ex : 50000"
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">Sert à estimer une date d'atteinte de l'objectif.</p>
      </div>
      <div className={stacked ? "" : "sm:col-span-3"}>
        <button
          type="submit"
          disabled={saving}
          className={
            stacked
              ? "mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium px-3 py-2.5 min-h-[44px] hover:bg-primary/90 disabled:opacity-50"
              : "mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium px-3 py-2 h-[38px] hover:bg-primary/90 disabled:opacity-50 shrink-0"
          }
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>
    </>
  );
}

export default function Goals() {
  const { goals, loading, addGoal, removeGoal, addFunds } = useSavingsGoals();
  const { kpis, depensesParCategorie, loading: loadingStats } = useFinancialStats();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [addAmounts, setAddAmounts] = useState({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.target_amount) return;
    setSaving(true);
    try {
      addGoal({
        name: form.name,
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount) || 0,
        monthly_contribution: Number(form.monthly_contribution) || 0,
      });
      toast({ title: "Objectif créé", description: form.name });
      setForm(emptyForm);
      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(goal) {
    setGoalToDelete(goal);
  }

  function confirmDeleteGoal() {
    if (!goalToDelete) return;
    removeGoal(goalToDelete.id);
    toast({ title: "Objectif supprimé", description: goalToDelete.name });
    setGoalToDelete(null);
  }

  function handleAddFunds(goal) {
    const amount = Number(addAmounts[goal.id]);
    if (!amount) return;
    const updated = addFunds(goal, amount);
    setAddAmounts((prev) => ({ ...prev, [goal.id]: "" }));
    if (updated.current_amount >= updated.target_amount) {
      toast({ title: "Objectif atteint 🎉", description: `${goal.name} est complet !` });
    } else {
      toast({ title: "Montant ajouté", description: `+${formatMGA(amount)} sur ${goal.name}` });
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Épargne</p>
        <h1 className="text-3xl font-heading font-semibold tracking-tight">Objectifs d'épargne</h1>
        <p className="text-sm text-muted-foreground">Suivez votre progression vers chaque objectif</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="hidden md:grid bg-card rounded-2xl border border-border p-5 shadow-warm-sm grid-cols-1 sm:grid-cols-3 gap-3 items-start"
      >
        <GoalFormFields form={form} setForm={setForm} saving={saving} stacked={false} />
      </form>

      {!loadingStats && (
        <WhatIfSimulator depensesParCategorie={depensesParCategorie} kpis={kpis} goals={goals} />
      )}

      {loading ? (
        <CardSkeleton count={3} />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Aucun objectif pour le moment"
          description="Créez votre premier objectif d'épargne avec le formulaire ci-dessus."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((g) => {
            const pct = g.target_amount ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
            const reached = g.current_amount >= g.target_amount;
            const projection = projectGoalDate(g.current_amount || 0, g.target_amount || 0, g.monthly_contribution || 0);
            return (
              <div key={g.id} className="bg-card rounded-2xl border border-border p-5 shadow-warm-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-9 w-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                      <PiggyBank className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-heading font-semibold truncate">{g.name}</p>
                      <p className="font-figure text-xs text-muted-foreground">
                        {formatMGA(g.current_amount)} / {formatMGA(g.target_amount)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(g)}
                    className="p-2.5 md:p-1.5 min-h-[44px] md:min-h-0 min-w-[44px] md:min-w-0 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-destructive/80 hover:text-destructive shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${reached ? "bg-success" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{pct}% atteint{reached ? " 🎉" : ""}</p>
                </div>

                {!reached && (
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/60 rounded-lg px-2.5 py-2">
                    <CalendarClock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    {projection ? (
                      <span>
                        Atteint vers <span className="font-medium text-foreground">{formatMonthYear(projection.date)}</span> (~{projection.months} mois)
                        {g.monthly_contribution ? ` à ${formatMGA(g.monthly_contribution)}/mois` : ""}
                      </span>
                    ) : (
                      <span>Ajoutez une contribution mensuelle prévue pour estimer une date.</span>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="Ajouter un montant"
                    value={addAmounts[g.id] || ""}
                    onChange={(e) => setAddAmounts((prev) => ({ ...prev, [g.id]: e.target.value }))}
                    className="font-figure flex-1 rounded-xl border border-border bg-background px-3 py-2 md:py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => handleAddFunds(g)}
                    className="rounded-xl border border-border px-3 py-2 md:py-1.5 min-h-[44px] md:min-h-0 text-sm font-medium hover:bg-muted"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="md:hidden fixed right-4 bottom-24 z-30 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-warm-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="Ajouter un objectif"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="md:hidden rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left mb-2">
            <SheetTitle>Nouvel objectif</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pb-4">
            <GoalFormFields form={form} setForm={setForm} saving={saving} stacked />
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!goalToDelete}
        onOpenChange={(open) => !open && setGoalToDelete(null)}
        title="Supprimer cet objectif ?"
        description={
          goalToDelete
            ? `"${goalToDelete.name}" sera définitivement supprimé. Cette action est irréversible.`
            : undefined
        }
        confirmLabel="Supprimer"
        onConfirm={confirmDeleteGoal}
      />
    </div>
  );
}
