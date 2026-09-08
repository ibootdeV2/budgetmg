import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatMGA } from "@/lib/budgetCategories";
import { getChartColor } from "@/lib/chartColors";

export default function ExpensePieChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Aucune dépense sur cette période
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div>
      {/* Demi-cercle avec le total au centre */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={75}
              outerRadius={115}
              paddingAngle={2}
              cornerRadius={8}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={getChartColor(i)} stroke="none" />
              ))}
            </Pie>
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
          </PieChart>
        </ResponsiveContainer>
        {/* Total centré, positionné sur la base du demi-cercle */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-1 pointer-events-none">
          <span className="font-figure font-bold text-2xl tracking-tight">
            {new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(total))}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            MGA total
          </span>
        </div>
      </div>

      {/* Légende façon liste, comme le composant "Devices" */}
      <div className="mt-2 space-y-2">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          const color = getChartColor(i);
          return (
            <div key={d.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate">{d.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-figure text-muted-foreground">{formatMGA(d.value)}</span>
                <span className="font-figure font-semibold w-14 text-right" style={{ color }}>
                  {pct.toFixed(1)} %
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
