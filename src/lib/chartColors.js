const CHART_TOKEN_COUNT = 8;

/**
 * Renvoie une couleur de graphique dérivée des tokens --chart-1 à --chart-8
 * définis dans index.css, plutôt que des hexadécimaux codés en dur : la
 * couleur suit donc automatiquement le thème clair/sombre.
 *
 * Au-delà de 8 séries (rare, mais possible avec beaucoup de catégories),
 * on recycle les mêmes teintes avec une opacité réduite plutôt que
 * d'inventer de nouvelles couleurs non prévues par le design system.
 */
export function getChartColor(index) {
  const tokenIndex = (index % CHART_TOKEN_COUNT) + 1;
  const cycle = Math.floor(index / CHART_TOKEN_COUNT);
  const opacity = cycle === 0 ? 1 : Math.max(0.45, 1 - cycle * 0.25);
  return `hsl(var(--chart-${tokenIndex}) / ${opacity})`;
}
