import { useMemo, useState } from "react";
import { Wand2, TrendingDown, PiggyBank, Layers, Percent, Coins, CalendarClock, Hourglass, TrendingUp } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatMGA } from "@/lib/budgetCategories";
import {
  formatMonthYear,
  simulateCategoryReduction,
  simulateCategoryReductionByAmount,
  simulateMultiCategoryReduction,
  simulateSavingsPlan,
  simulateProgressiveSavingsPlan,
  projectGoalDate,
  monthsBetween,
  requiredMonthlyForTargetDate,
  requiredStartContributionForTargetDate,
} from "@/lib/projections";

/** Petit input numérique compact, réutilisé un peu partout dans le simulateur. */
function NumberField({ label, value, onChange, suffix, className = "" }) {
  return (
    <div className={className}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative mt-1">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

/** Petit graphique en barres "avant / après", pour visualiser l'impact d'une réduction
 *  sur chaque catégorie concernée + sur l'épargne mensuelle globale. */
function ImpactChart({ data }) {
  if (!data || data.length === 0) return null;
  const rotate = data.length > 2;
  return (
    <div className="h-52 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: rotate ? 24 : 4 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis
            dataKey="name"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={rotate ? -20 : 0}
            textAnchor={rotate ? "end" : "middle"}
            height={rotate ? 40 : 20}
          />
          <YAxis width={0} tickFormatter={(v) => new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v)} fontSize={11} />
          <Tooltip
            formatter={(v) => formatMGA(v)}
            contentStyle={{
              fontFamily: "var(--font-body)",
              borderRadius: 12,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(v) => (v === "avant" ? "Avant" : "Après")}
          />
          <Bar dataKey="avant" name="avant" fill="hsl(var(--muted-foreground))" fillOpacity={0.3} radius={[6, 6, 0, 0]} />
          <Bar dataKey="apres" name="apres" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Onglet 1 : "et si je réduisais telle(s) dépense(s) ?" — % libre, montant MGA, ou plusieurs catégories combinées */
function ReductionSimulator({ depensesParCategorie, currentMonthlySavings }) {
  const [mode, setMode] = useState("single"); // "single" | "multi"
  const [unit, setUnit] = useState("pct"); // "pct" | "amount" — pour le mode single

  // --- Mode "single" : une catégorie, % libre ou montant direct ---
  const [categoryName, setCategoryName] = useState(depensesParCategorie[0]?.name || "");
  const [pct, setPct] = useState(15);
  const [amount, setAmount] = useState(0);

  const category = depensesParCategorie.find((c) => c.name === categoryName);
  const spend = category?.value || 0;

  const singleResult = useMemo(() => {
    if (unit === "amount") {
      return simulateCategoryReductionByAmount(spend, Number(amount) || 0, currentMonthlySavings);
    }
    return simulateCategoryReduction(spend, Number(pct) || 0, currentMonthlySavings);
  }, [spend, unit, amount, pct, currentMonthlySavings]);

  const singleChartData = useMemo(() => {
    if (!category) return [];
    return [
      { name: category.name, avant: spend, apres: Math.max(0, singleResult.newCategorySpend) },
      { name: "Épargne / mois", avant: currentMonthlySavings, apres: singleResult.newMonthlySavings },
    ];
  }, [category, spend, singleResult, currentMonthlySavings]);

  // --- Mode "multi" : plusieurs catégories cochées, chacune avec sa propre réduction ---
  const [selected, setSelected] = useState(() => new Set());
  const [multiPct, setMultiPct] = useState({}); // { [name]: pct }
  const [multiAmount, setMultiAmount] = useState({}); // { [name]: amount }
  const [multiUnit, setMultiUnit] = useState({}); // { [name]: "pct" | "amount" }

  const toggleSelected = (name) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const multiEntries = useMemo(
    () =>
      depensesParCategorie
        .filter((c) => selected.has(c.name))
        .map((c) => {
          const unitForCat = multiUnit[c.name] || "pct";
          return {
            name: c.name,
            spend: c.value,
            pct: unitForCat === "pct" ? Number(multiPct[c.name] ?? 15) : undefined,
            amount: unitForCat === "amount" ? Number(multiAmount[c.name] ?? 0) : undefined,
          };
        }),
    [depensesParCategorie, selected, multiPct, multiAmount, multiUnit]
  );

  const multiResult = useMemo(
    () => simulateMultiCategoryReduction(multiEntries, currentMonthlySavings),
    [multiEntries, currentMonthlySavings]
  );

  const multiChartData = useMemo(() => {
    if (!multiResult.perCategory?.length) return [];
    return [
      ...multiResult.perCategory.map((c) => ({
        name: c.name,
        avant: c.spend,
        apres: Math.max(0, c.newCategorySpend),
      })),
      { name: "Épargne / mois", avant: currentMonthlySavings, apres: multiResult.newMonthlySavings },
    ];
  }, [multiResult, currentMonthlySavings]);

  const result = mode === "multi" ? multiResult : singleResult;

  if (depensesParCategorie.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Ajoutez des dépenses ce mois-ci pour pouvoir simuler une réduction.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && setMode(v)}
        className="grid grid-cols-2 gap-2"
      >
        <ToggleGroupItem value="single" className="rounded-xl border border-border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground gap-1.5 text-xs">
          <TrendingDown className="h-3.5 w-3.5" />
          Une catégorie
        </ToggleGroupItem>
        <ToggleGroupItem value="multi" className="rounded-xl border border-border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground gap-1.5 text-xs">
          <Layers className="h-3.5 w-3.5" />
          Plusieurs catégories
        </ToggleGroupItem>
      </ToggleGroup>

      {mode === "single" && (
        <>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Catégorie à réduire</label>
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {depensesParCategorie.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} — {formatMGA(c.value)}
                </option>
              ))}
            </select>
          </div>

          <ToggleGroup
            type="single"
            value={unit}
            onValueChange={(v) => v && setUnit(v)}
            className="grid grid-cols-2 gap-2"
          >
            <ToggleGroupItem value="pct" className="rounded-xl border border-border data-[state=on]:bg-accent data-[state=on]:text-accent-foreground gap-1.5 text-xs">
              <Percent className="h-3.5 w-3.5" />
              En %
            </ToggleGroupItem>
            <ToggleGroupItem value="amount" className="rounded-xl border border-border data-[state=on]:bg-accent data-[state=on]:text-accent-foreground gap-1.5 text-xs">
              <Coins className="h-3.5 w-3.5" />
              En MGA
            </ToggleGroupItem>
          </ToggleGroup>

          {unit === "pct" ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-muted-foreground">Réduction simulée</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={pct}
                    onChange={(e) => setPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="font-figure text-sm font-semibold text-primary">%</span>
                </div>
              </div>
              {/* Pas libre (step 1) au lieu de paliers de 5% — glisser reste possible, le champ ci-dessus permet une valeur exacte, décimales incluses */}
              <Slider value={[pct]} onValueChange={([v]) => setPct(v)} min={0} max={100} step={1} />
            </div>
          ) : (
            <NumberField
              label={`Montant économisé / mois (max ${formatMGA(spend)})`}
              value={amount}
              onChange={(v) => setAmount(Math.min(spend, Math.max(0, Number(v) || 0)))}
              suffix="MGA"
            />
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-xl bg-success/10 p-3">
              <p className="text-[11px] text-success font-medium">Économie / mois</p>
              <p className="font-figure text-base font-semibold text-success">
                +{formatMGA(singleResult.monthlySaved)}
              </p>
            </div>
            <div className="rounded-xl bg-success/10 p-3">
              <p className="text-[11px] text-success font-medium">Économie / an</p>
              <p className="font-figure text-base font-semibold text-success">
                +{formatMGA(singleResult.annualSaved)}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Votre épargne mensuelle passerait de{" "}
            <span className="font-medium text-foreground">{formatMGA(currentMonthlySavings)}</span> à{" "}
            <span className="font-medium text-foreground">{formatMGA(singleResult.newMonthlySavings)}</span>
            {unit === "amount" && spend > 0 && (
              <> (≈ {singleResult.impliedPct.toFixed(1)}% de la catégorie)</>
            )}
            .
          </p>

          <ImpactChart data={singleChartData} />
        </>
      )}

      {mode === "multi" && (
        <>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {depensesParCategorie.map((c) => {
              const isChecked = selected.has(c.name);
              const unitForCat = multiUnit[c.name] || "pct";
              return (
                <div
                  key={c.name}
                  className={`rounded-xl border p-2.5 transition-colors ${
                    isChecked ? "border-primary/40 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleSelected(c.name)} />
                    <span className="text-sm font-medium flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatMGA(c.value)}</span>
                  </div>

                  {isChecked && (
                    <div className="mt-2 flex items-center gap-2 pl-6">
                      <ToggleGroup
                        type="single"
                        value={unitForCat}
                        onValueChange={(v) => v && setMultiUnit((prev) => ({ ...prev, [c.name]: v }))}
                        className="gap-1"
                      >
                        <ToggleGroupItem value="pct" className="h-7 rounded-lg px-2 text-[11px] border border-border data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                          %
                        </ToggleGroupItem>
                        <ToggleGroupItem value="amount" className="h-7 rounded-lg px-2 text-[11px] border border-border data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                          MGA
                        </ToggleGroupItem>
                      </ToggleGroup>

                      {unitForCat === "pct" ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={multiPct[c.name] ?? 15}
                          onChange={(e) =>
                            setMultiPct((prev) => ({ ...prev, [c.name]: Math.min(100, Math.max(0, Number(e.target.value))) }))
                          }
                          className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={c.value}
                          value={multiAmount[c.name] ?? 0}
                          onChange={(e) =>
                            setMultiAmount((prev) => ({ ...prev, [c.name]: Math.min(c.value, Math.max(0, Number(e.target.value) || 0)) }))
                          }
                          className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-right text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selected.size === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Cochez une ou plusieurs catégories à combiner.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl bg-success/10 p-3">
                  <p className="text-[11px] text-success font-medium">Économie / mois</p>
                  <p className="font-figure text-base font-semibold text-success">
                    +{formatMGA(multiResult.monthlySaved)}
                  </p>
                </div>
                <div className="rounded-xl bg-success/10 p-3">
                  <p className="text-[11px] text-success font-medium">Économie / an</p>
                  <p className="font-figure text-base font-semibold text-success">
                    +{formatMGA(multiResult.annualSaved)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Votre épargne mensuelle passerait de{" "}
                <span className="font-medium text-foreground">{formatMGA(currentMonthlySavings)}</span> à{" "}
                <span className="font-medium text-foreground">{formatMGA(multiResult.newMonthlySavings)}</span>{" "}
                en combinant {selected.size} catégorie{selected.size > 1 ? "s" : ""}.
              </p>

              <ImpactChart data={multiChartData} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Onglet 2 : "et si j'épargnais X/mois (ou pour une date précise), à rythme fixe ou progressif ?" */
function SavingsPlanSimulator({ goals }) {
  const [goalId, setGoalId] = useState(goals[0]?.id || "");
  const [durationMode, setDurationMode] = useState("months"); // "months" | "date"
  const [rateMode, setRateMode] = useState("flat"); // "flat" | "progressive"

  const [monthlyAmount, setMonthlyAmount] = useState(50000);
  const [months, setMonths] = useState(6);
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().slice(0, 10);
  });

  const [startContribution, setStartContribution] = useState(30000);
  const [monthlyIncrement, setMonthlyIncrement] = useState(5000);

  const goal = goals.find((g) => g.id === goalId);
  const startAmount = goal?.current_amount || 0;
  const target = goal?.target_amount || 0;
  const remaining = Math.max(0, target - startAmount);
  const today = new Date();

  // Nombre de mois effectif selon le mode durée choisi
  const effectiveMonths = useMemo(() => {
    if (durationMode === "months") return Number(months) || 0;
    return monthsBetween(today, new Date(targetDate));
  }, [durationMode, months, targetDate]);

  // Pour le mode "date cible" : calcule automatiquement le rythme requis
  const requiredFlat = useMemo(() => {
    if (durationMode !== "date" || !goal || remaining <= 0) return null;
    return requiredMonthlyForTargetDate(remaining, today, new Date(targetDate));
  }, [durationMode, goal, remaining, targetDate]);

  const requiredProgressive = useMemo(() => {
    if (durationMode !== "date" || !goal || remaining <= 0) return null;
    return requiredStartContributionForTargetDate(remaining, today, new Date(targetDate), Number(monthlyIncrement) || 0);
  }, [durationMode, goal, remaining, targetDate, monthlyIncrement]);

  // Contribution de départ effective (mode flat) : saisie libre, ou calculée si date cible + objectif choisi
  const effectiveFlatMonthly =
    durationMode === "date" && goal && requiredFlat ? requiredFlat.requiredMonthly : Number(monthlyAmount) || 0;

  const effectiveStartContribution =
    durationMode === "date" && goal && requiredProgressive
      ? requiredProgressive.requiredStartContribution
      : Number(startContribution) || 0;

  const trajectory = useMemo(() => {
    if (effectiveMonths <= 0) return [];
    if (rateMode === "progressive") {
      return simulateProgressiveSavingsPlan(startAmount, effectiveStartContribution, Number(monthlyIncrement) || 0, effectiveMonths);
    }
    return simulateSavingsPlan(startAmount, effectiveFlatMonthly, effectiveMonths);
  }, [rateMode, startAmount, effectiveStartContribution, monthlyIncrement, effectiveFlatMonthly, effectiveMonths]);

  // Projection de date (uniquement pertinente en mode "durée fixe", puisqu'en mode "date cible" on vise déjà la date)
  const projection =
    goal && durationMode === "months" && rateMode === "flat"
      ? projectGoalDate(startAmount, target, Number(monthlyAmount) || 0)
      : null;

  const finalAmount = trajectory[trajectory.length - 1]?.amount || 0;

  return (
    <div className="space-y-4">
      {goals.length > 0 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground">Objectif concerné (optionnel)</label>
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Simulation libre (sans objectif)</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {formatMGA(g.current_amount)} / {formatMGA(g.target_amount)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <ToggleGroup
          type="single"
          value={durationMode}
          onValueChange={(v) => v && setDurationMode(v)}
          className="col-span-2 grid grid-cols-2 gap-2"
        >
          <ToggleGroupItem value="months" className="rounded-xl border border-border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground gap-1.5 text-xs">
            <Hourglass className="h-3.5 w-3.5" />
            Nombre de mois
          </ToggleGroupItem>
          <ToggleGroupItem value="date" className="rounded-xl border border-border data-[state=on]:bg-primary data-[state=on]:text-primary-foreground gap-1.5 text-xs">
            <CalendarClock className="h-3.5 w-3.5" />
            Date cible
          </ToggleGroupItem>
        </ToggleGroup>

        <ToggleGroup
          type="single"
          value={rateMode}
          onValueChange={(v) => v && setRateMode(v)}
          className="col-span-2 grid grid-cols-2 gap-2"
        >
          <ToggleGroupItem value="flat" className="rounded-xl border border-border data-[state=on]:bg-accent data-[state=on]:text-accent-foreground gap-1.5 text-xs">
            <PiggyBank className="h-3.5 w-3.5" />
            Épargne constante
          </ToggleGroupItem>
          <ToggleGroupItem value="progressive" className="rounded-xl border border-border data-[state=on]:bg-accent data-[state=on]:text-accent-foreground gap-1.5 text-xs">
            <TrendingUp className="h-3.5 w-3.5" />
            Épargne progressive
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {!goal && durationMode === "date" && (
        <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
          Choisissez un objectif ci-dessus pour que le rythme d'épargne requis soit calculé automatiquement à partir de la date cible.
        </p>
      )}

      <div className="flex gap-3">
        {durationMode === "months" ? (
          <NumberField label="Durée (mois)" value={months} onChange={setMonths} className="w-28" />
        ) : (
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">Date cible</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {rateMode === "flat" ? (
          durationMode === "months" ? (
            <NumberField label="Épargne / mois (MGA)" value={monthlyAmount} onChange={setMonthlyAmount} className="flex-1" />
          ) : (
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">Épargne / mois requise</label>
              <div className="mt-1 rounded-xl border border-dashed border-border bg-muted px-3 py-2.5 text-sm text-right tabular-nums">
                {goal ? formatMGA(effectiveFlatMonthly) : "—"}
              </div>
            </div>
          )
        ) : (
          <NumberField
            label={durationMode === "months" ? "1er mois (MGA)" : "1er mois requis"}
            value={durationMode === "months" ? startContribution : Math.round(effectiveStartContribution)}
            onChange={durationMode === "months" ? setStartContribution : () => {}}
            className="flex-1"
          />
        )}
      </div>

      {rateMode === "progressive" && (
        <NumberField
          label="Augmentation chaque mois (MGA)"
          value={monthlyIncrement}
          onChange={setMonthlyIncrement}
          suffix="/ mois"
        />
      )}

      {trajectory.length > 1 && (
        <div className="h-40 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trajectory} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="whatifGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="month" tickFormatter={(m) => `M${m}`} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                width={0}
                tickFormatter={(v) => new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v)}
                fontSize={11}
              />
              <Tooltip formatter={(v) => formatMGA(v)} labelFormatter={(m) => `Mois ${m}`} contentStyle={{ fontFamily: "var(--font-body)", borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }} />
              {target > 0 && (
                <ReferenceLine y={target} stroke="hsl(var(--success))" strokeDasharray="4 4" label={{ value: "Objectif", fontSize: 10, fill: "hsl(var(--success))" }} />
              )}
              <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#whatifGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="rounded-xl bg-muted p-3 space-y-1">
        <p className="text-xs text-muted-foreground">
          Après {effectiveMonths || 0} mois : <span className="font-medium text-foreground">{formatMGA(finalAmount)}</span>
        </p>

        {goal && durationMode === "months" && projection?.reached === false && (
          <p className="text-xs text-muted-foreground">
            Objectif "{goal.name}" atteint vers{" "}
            <span className="font-medium text-foreground">{formatMonthYear(projection.date)}</span> (~{projection.months} mois à ce rythme).
          </p>
        )}
        {goal && durationMode === "months" && projection?.reached === true && (
          <p className="text-xs text-success font-medium">Cet objectif est déjà atteint 🎉</p>
        )}
        {goal && durationMode === "date" && remaining > 0 && (
          <p className="text-xs text-muted-foreground">
            Pour atteindre "{goal.name}" ({formatMGA(remaining)} restants) d'ici{" "}
            <span className="font-medium text-foreground">{formatMonthYear(new Date(targetDate))}</span>, il faut épargner{" "}
            {rateMode === "flat" ? (
              <span className="font-medium text-foreground">{formatMGA(effectiveFlatMonthly)}/mois</span>
            ) : (
              <>
                à partir de <span className="font-medium text-foreground">{formatMGA(effectiveStartContribution)}</span> le
                1er mois, +{formatMGA(Number(monthlyIncrement) || 0)}/mois ensuite
              </>
            )}
            .
          </p>
        )}
        {goal && remaining <= 0 && (
          <p className="text-xs text-success font-medium">Cet objectif est déjà atteint 🎉</p>
        )}
      </div>
    </div>
  );
}

export default function WhatIfSimulator({ depensesParCategorie, kpis, goals }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-warm-sm space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
          <Wand2 className="h-4 w-4" />
        </span>
        <div>
          <p className="font-heading font-semibold">Simulateur "et si"</p>
          <p className="text-xs text-muted-foreground">Testez l'impact d'une décision avant de la prendre</p>
        </div>
      </div>

      <Tabs defaultValue="reduction">
        <TabsList>
          <TabsTrigger value="reduction" className="gap-1.5">
            <TrendingDown className="h-3.5 w-3.5" />
            Réduire une dépense
          </TabsTrigger>
          <TabsTrigger value="plan" className="gap-1.5">
            <PiggyBank className="h-3.5 w-3.5" />
            Plan d'épargne
          </TabsTrigger>
        </TabsList>
        <TabsContent value="reduction">
          <ReductionSimulator depensesParCategorie={depensesParCategorie} currentMonthlySavings={kpis.epargne} />
        </TabsContent>
        <TabsContent value="plan">
          <SavingsPlanSimulator goals={goals} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
