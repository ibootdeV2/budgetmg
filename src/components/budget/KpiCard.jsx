import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";

const TONE_STYLES = {
  primary: { bar: "bg-primary", icon: "bg-primary/10 text-primary" },
  success: { bar: "bg-success", icon: "bg-success/10 text-success" },
  danger: { bar: "bg-destructive", icon: "bg-destructive/10 text-destructive" },
  accent: { bar: "bg-accent", icon: "bg-accent/15 text-accent" },
};

/**
 * @param {number} value - valeur brute (pas déjà formatée) : c'est elle qui est animée.
 * @param {(n: number) => string} format - ex. formatMGA, ou n => `${n.toFixed(1)} %`.
 * @param {number} [variation] - variation en % vs la période précédente. Positif = hausse.
 * @param {boolean} [invertVariationColor] - pour les dépenses, une hausse est "mauvaise" (rouge) : passer true.
 * @param {number} [index] - position dans la grille, pilote le léger décalage d'entrée.
 * @param {boolean} [dark] - carte "inversée" (fond sombre, texte clair) pour mettre une carte
 *   en avant au milieu des autres — ex. "Solde total" sur le tableau de bord.
 * @param {string} [variationLabel] - unité affichée après le chiffre de variation
 *   (par défaut "% vs mois préc." ; ex. "pts vs mois préc." pour un taux en points).
 */
export default function KpiCard({
  label,
  value,
  format,
  icon: Icon,
  tone = "primary",
  variation,
  invertVariationColor = false,
  index = 0,
  dark = false,
  variationLabel = "% vs mois préc.",
}) {
  const animatedValue = useAnimatedNumber(value);
  const hasVariation = typeof variation === "number" && Number.isFinite(variation);
  const isPositive = variation >= 0;
  const isGood = invertVariationColor ? !isPositive : isPositive;
  const toneStyle = TONE_STYLES[tone] || TONE_STYLES.primary;

  return (
    <div
      className={cn(
        "relative rounded-2xl pl-5 pr-4 py-4 shadow-warm-sm flex items-start justify-between gap-3 overflow-hidden",
        dark ? "bg-foreground text-background" : "bg-card border border-border"
      )}
      style={{ "--stagger": index }}
    >
      {!dark && <span className={cn("absolute left-0 top-0 bottom-0 w-1", toneStyle.bar)} />}
      <div className="min-w-0">
        <p className={cn("text-xs truncate", dark ? "text-background/55" : "text-muted-foreground")}>
          {label}
        </p>
        <p className="font-figure text-lg font-semibold tracking-tight mt-1 truncate">
          {format(animatedValue)}
        </p>
        {hasVariation && (
          <p
            className={cn(
              "text-xs font-medium mt-1 inline-flex items-center gap-0.5",
              isGood ? "text-success" : "text-destructive"
            )}
          >
            {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(variation).toFixed(1)} {variationLabel}
          </p>
        )}
      </div>
      {Icon && !dark && (
        <span className={cn("shrink-0 h-9 w-9 rounded-xl flex items-center justify-center", toneStyle.icon)}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      )}
    </div>
  );
}
