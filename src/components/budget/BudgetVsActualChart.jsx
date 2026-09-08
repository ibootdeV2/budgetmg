import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatMGA } from "@/lib/budgetCategories";

/**
 * Courbe "Prévu vs réel", mois par mois. "Réel" est affiché en aire pleine
 * (dégradé bleu) pour bien ressortir comme la donnée principale, "Prévu"
 * en ligne violette pointillée par-dessus, comme repère de comparaison.
 *
 * @param {{ name: string, Prévu: number, Réel: number }[]} data
 * @param {boolean} [showDepassements] - affiche sous le graphique la liste des
 *   mois en dépassement. À désactiver si cette info est déjà montrée ailleurs
 *   (ex. la pastille "Dépassements" du tableau de bord).
 */
export default function BudgetVsActualChart({ data, showDepassements = true }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Aucune donnée de budget pour cette période
      </div>
    );
  }

  const depassements = data.filter((d) => (d.Prévu || 0) > 0 && (d.Réel || 0) > d.Prévu);

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="budgetRealFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontFamily: "var(--font-body)" }}
          />
          <YAxis
            tickFormatter={(v) => `${Math.round(v / 1000)}K`}
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontFamily: "var(--font-body)" }}
          />
          <Tooltip
            formatter={(value) => formatMGA(value)}
            contentStyle={{
              fontFamily: "var(--font-body)",
              borderRadius: 12,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-body)", paddingTop: 8 }}
          />
          <Area
            type="monotone"
            dataKey="Réel"
            name="Réel"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2.5}
            fill="url(#budgetRealFill)"
            dot={{ r: 3.5, fill: "hsl(var(--chart-1))", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Prévu"
            name="Prévu"
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Là où "Réel" dépasse "Prévu" : rappel explicite, plus facile à repérer
          d'un coup d'œil que de comparer deux courbes. */}
      {showDepassements && depassements.length > 0 && (
        <div className="mt-1 pt-3 border-t border-border space-y-1">
          {depassements.map((d) => (
            <p key={d.name} className="text-xs text-destructive">
              <span className="font-medium">{d.name}</span> dépassé de{" "}
              {formatMGA(d.Réel - d.Prévu)} ({Math.round((d.Réel / d.Prévu) * 100)}% du prévu)
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
