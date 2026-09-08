import { forwardRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MONTHS } from "@/lib/budgetCategories";

/**
 * Remplace l'ancien bouton "dupliquer janvier partout" par quelque chose de
 * plus utile : un montant à appliquer + le choix des mois concernés
 * (tous, ceux qui restent dans l'année, ou une sélection libre). Couvre le
 * cas simple (loyer fixe → tous les mois) comme les cas irréguliers
 * (vacances en juillet/août, 13e mois en décembre, etc.).
 */

const SCOPES = [
  { id: "all", label: "Tous les mois" },
  { id: "remaining", label: "Mois restants de l'année" },
  { id: "custom", label: "Choisir les mois" },
];

// forwardRef + spread des props : le bouton est utilisé comme PopoverTrigger
// asChild, qui injecte onClick/ref sur cet élément.
const IconButton = forwardRef(function IconButton({ className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      title="Copier ce montant sur plusieurs mois d'un coup"
      className={className}
      {...props}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
});

export default function ApplyToMonthsPopover({
  category,
  currentMonth = new Date().getMonth() + 1,
  defaultAmount = "",
  onApply,
  triggerClassName = "p-1.5 rounded-lg hover:bg-muted text-muted-foreground",
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [scope, setScope] = useState("all");
  const [selectedMonths, setSelectedMonths] = useState([]);

  function monthsForScope() {
    if (scope === "all") return Array.from({ length: 12 }, (_, i) => i + 1);
    if (scope === "remaining") return Array.from({ length: 12 - currentMonth + 1 }, (_, i) => currentMonth + i);
    return selectedMonths;
  }

  function toggleMonth(m) {
    setSelectedMonths((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a, b) => a - b)));
  }

  function reset() {
    setAmount("");
    setScope("all");
    setSelectedMonths([]);
  }

  function handleSubmit() {
    const months = monthsForScope();
    if (amount === "" || months.length === 0) return;
    onApply(Number(amount) || 0, months);
    setOpen(false);
    reset();
  }

  const canSubmit = amount !== "" && (scope !== "custom" || selectedMonths.length > 0);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
        else if (defaultAmount) setAmount(String(defaultAmount));
      }}
    >
      <PopoverTrigger asChild>
        <IconButton
          className={triggerClassName}
          title="Appliquer un montant à plusieurs mois"
          aria-label={`Appliquer un montant à plusieurs mois pour ${category}`}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-2xl p-4 space-y-3 shadow-warm-lg">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 truncate">{category}</p>
          <input
            type="number"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Montant à appliquer"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          {SCOPES.map((s) => (
            <label
              key={s.id}
              className="flex items-center gap-2 text-sm cursor-pointer text-foreground/90 hover:text-foreground"
            >
              <input
                type="radio"
                name={`scope-${category}`}
                checked={scope === s.id}
                onChange={() => setScope(s.id)}
                className="accent-primary h-3.5 w-3.5"
              />
              {s.label}
            </label>
          ))}
        </div>

        {scope === "custom" && (
          <div className="grid grid-cols-4 gap-1 pt-1">
            {MONTHS.map((m, i) => {
              const num = i + 1;
              const selected = selectedMonths.includes(num);
              return (
                <button
                  type="button"
                  key={m}
                  onClick={() => toggleMonth(num)}
                  className={`rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-colors"
        >
          <Check className="h-4 w-4" />
          Appliquer
        </button>
      </PopoverContent>
    </Popover>
  );
}
