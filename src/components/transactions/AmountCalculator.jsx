import { forwardRef, useEffect, useRef, useState } from "react";
import { Calculator, Delete } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Drawer, DrawerTrigger, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Calculatrice pour le champ "Montant".
 * Permet de taper une expression (ex : 5000+3200×2) plutôt que de calculer
 * le total à la main avant de le saisir. Le résultat remplace la valeur
 * du champ montant au tap sur "=" ou en appuyant sur Entrée.
 *
 * - Desktop : popover ancré au bouton déclencheur.
 * - Mobile : feuille plein-large qui remonte du bas (comme le formulaire
 *   de transaction lui-même), avec des touches plus grandes — plus sûr au
 *   pouce qu'un popover minuscule, et cohérent avec le reste de l'app.
 *
 * Évaluation "safe" : uniquement chiffres, . + - * / ( ) et espaces sont
 * autorisés, aucun accès à eval/Function sur une chaîne arbitraire au-delà
 * de ce charset validé.
 */

const KEYS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  ["00", "0", ".", "+"],
];

const SYMBOL_TO_OP = { "÷": "/", "×": "*", "−": "-" };
const OPERATORS = ["÷", "×", "−", "+"];

function formatAmount(n) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
}

function safeEvaluate(expr) {
  if (!expr || !/^[0-9+\-*/.() ]+$/.test(expr)) return null;
  if (/(\*\*|\/\/|\+\+|--){1}/.test(expr)) return null;
  // Empêche une expression qui se termine par un opérateur (résultat en cours de frappe)
  if (/[+\-*/.]\s*$/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result !== "number" || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

/** Ré-écrit l'expression brute (avec / * -) en version affichable (÷ × −). */
function toDisplay(expr) {
  return expr.replace(/\//g, "÷").replace(/\*/g, "×").replace(/-/g, "−");
}

function useCalculatorState(onApply, onDone) {
  const [expr, setExpr] = useState("");
  const [error, setError] = useState(false);
  const [pressedKey, setPressedKey] = useState(null);

  const preview = safeEvaluate(expr);
  const hasOperator = /[+\-*/]/.test(expr);

  function reset() {
    setExpr("");
    setError(false);
  }

  function bump(key) {
    setPressedKey(key);
    setTimeout(() => setPressedKey(null), 150);
  }

  function handleKey(key) {
    bump(key);
    setError(false);
    if (key === "C") {
      setExpr("");
      return;
    }
    const op = SYMBOL_TO_OP[key] ?? key;
    setExpr((prev) => prev + op);
  }

  function handleBackspace() {
    bump("back");
    setError(false);
    setExpr((prev) => prev.slice(0, -1));
  }

  function handleEquals() {
    bump("equals");
    if (!expr.trim()) return;
    const result = safeEvaluate(expr);
    if (result === null) {
      setError(true);
      return;
    }
    const rounded = Math.round(result * 100) / 100;
    onApply(String(rounded));
    reset();
    onDone();
  }

  function setRawExpr(displayValue) {
    setError(false);
    setExpr(
      displayValue.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-")
    );
  }

  return {
    expr,
    error,
    pressedKey,
    preview,
    hasOperator,
    reset,
    handleKey,
    handleBackspace,
    handleEquals,
    setRawExpr,
  };
}

/** Écran (expression + aperçu du résultat). Taille adaptable desktop/mobile. */
function CalcScreen({ calc, displayRef, size = "md" }) {
  const big = size === "lg";
  return (
    <div
      className={`relative bg-gradient-to-br from-primary to-primary/80 ${
        big ? "px-5 pb-5 pt-2" : "px-4 pb-4 pt-3.5 rounded-t-2xl"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/60">
          Calculatrice
        </span>
        {calc.expr && (
          <button
            type="button"
            onClick={() => calc.handleKey("C")}
            className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/60 transition-colors hover:text-primary-foreground"
          >
            Effacer
          </button>
        )}
      </div>
      <input
        ref={displayRef}
        type="text"
        inputMode="decimal"
        value={toDisplay(calc.expr)}
        onChange={(e) => calc.setRawExpr(e.target.value)}
        placeholder="0"
        className={`w-full bg-transparent text-right font-mono font-medium leading-tight text-primary-foreground caret-primary-foreground placeholder:text-primary-foreground/40 focus:outline-none ${
          big ? "text-[34px]" : "text-[26px]"
        }`}
      />
      <div className={big ? "h-5 text-right" : "h-[18px] text-right"}>
        {calc.error ? (
          <span className="text-xs font-medium text-destructive-foreground/90 animate-in fade-in slide-in-from-top-1 duration-150">
            Expression invalide
          </span>
        ) : (
          calc.hasOperator &&
          calc.preview !== null && (
            <span
              className={`font-mono text-primary-foreground/55 animate-in fade-in duration-150 ${
                big ? "text-sm" : "text-xs"
              }`}
            >
              = {formatAmount(calc.preview)}
            </span>
          )
        )}
      </div>
    </div>
  );
}

/** Clavier. `size="lg"` = touches plus hautes/plus grand texte pour le mobile. */
function CalcKeypad({ calc, size = "md" }) {
  const big = size === "lg";
  const keyClass = big ? "py-4 text-xl" : "py-2.5 text-[15px]";
  return (
    <div className={`grid grid-cols-4 gap-1.5 ${big ? "p-4 pt-3" : "p-3"}`}>
      {KEYS.flat().map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => calc.handleKey(key)}
          className={`relative rounded-xl font-semibold transition-all duration-100 ease-[var(--ease-out)] active:scale-90 touch-target ${keyClass} ${
            calc.pressedKey === key ? "scale-90" : ""
          } ${
            OPERATORS.includes(key)
              ? "bg-primary/10 text-primary hover:bg-primary/15"
              : "bg-muted text-foreground hover:bg-muted/70 font-mono tabular-nums"
          }`}
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        onClick={calc.handleBackspace}
        className={`relative flex items-center justify-center rounded-xl bg-muted text-muted-foreground transition-all duration-100 ease-[var(--ease-out)] hover:bg-destructive/10 hover:text-destructive active:scale-90 touch-target ${keyClass} ${
          calc.pressedKey === "back" ? "scale-90" : ""
        }`}
        aria-label="Effacer un caractère"
      >
        <Delete className={big ? "h-5 w-5" : "h-4 w-4"} />
      </button>
      <button
        type="button"
        onClick={calc.handleEquals}
        className={`relative col-span-3 rounded-xl bg-primary font-bold text-primary-foreground shadow-warm-sm transition-all duration-100 ease-[var(--ease-out)] hover:bg-primary/90 hover:shadow-warm active:scale-[0.97] touch-target ${keyClass} ${
          calc.pressedKey === "equals" ? "scale-[0.97]" : ""
        }`}
      >
        =
      </button>
    </div>
  );
}

// forwardRef + spread des props (onClick, aria-*, etc.) : indispensable pour
// que Radix Popover.Trigger et vaul Drawer.Trigger — utilisés avec `asChild`
// juste au-dessus — puissent injecter leur gestionnaire de clic et leur ref
// sur le vrai <button>. Sans ça, le bouton s'affiche mais ne réagit plus.
const CalculatorTrigger = forwardRef(function CalculatorTrigger(
  { className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`group relative inline-flex items-center justify-center rounded-xl border border-border bg-background text-muted-foreground overflow-hidden transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] hover:text-primary hover:border-primary/40 hover:shadow-warm-sm active:scale-95 touch-target ${className}`}
      aria-label="Ouvrir la calculatrice"
      title="Calculatrice"
      {...props}
    >
      <span className="absolute inset-0 scale-0 rounded-xl bg-primary/10 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:scale-100" />
      <Calculator className="relative h-4 w-4 transition-transform duration-[var(--duration-base)] ease-[var(--ease-out)] group-hover:-rotate-6 group-hover:scale-110" />
    </button>
  );
});

export default function AmountCalculator({ onApply, className = "" }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const displayRef = useRef(null);
  const calc = useCalculatorState(onApply, () => setOpen(false));

  useEffect(() => {
    if (open && !isMobile && displayRef.current) {
      // Petit délai pour laisser l'animation d'ouverture démarrer avant le focus.
      const t = setTimeout(() => displayRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, isMobile]);

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      calc.handleEquals();
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && document.activeElement !== displayRef.current) {
      e.preventDefault();
      calc.handleBackspace();
    }
  }

  function handleOpenChange(next) {
    setOpen(next);
    if (!next) calc.reset();
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <CalculatorTrigger className={className} />
        </DrawerTrigger>
        <DrawerContent className="rounded-t-2xl border-none bg-card p-0 pb-[env(safe-area-inset-bottom)]">
          <DrawerTitle className="sr-only">Calculatrice</DrawerTitle>
          <CalcScreen calc={calc} displayRef={displayRef} size="lg" />
          <CalcKeypad calc={calc} size="lg" />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <CalculatorTrigger className={className} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 overflow-hidden rounded-2xl border-border/80 bg-card p-0 shadow-warm-lg"
        onKeyDown={handleKeyDown}
      >
        <CalcScreen calc={calc} displayRef={displayRef} size="md" />
        <CalcKeypad calc={calc} size="md" />
      </PopoverContent>
    </Popover>
  );
}
