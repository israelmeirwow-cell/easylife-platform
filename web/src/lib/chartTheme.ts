/** Shared ECharts styling for the light Easy Life (Aether) theme.
 *
 * Palette follows index.css tokens: deep-teal signature accent ("gold" token),
 * slate ink, cyan/violet glows. Keep chart colors in sync with the CSS vars.
 */

export const CHART_COLORS = {
  gold: '#0e8ba0', // signature deep teal (token --color-gold)
  goldStrong: '#0b7688',
  cyan: '#22b8cf',
  violet: '#7c6cf0',
  blue: '#6d8bf0',
  charcoal: '#0f172a',
  ink: '#0f172a',
  muted: '#55627a',
  faint: '#94a3b8',
  border: '#e5e9f0',
  success: '#12805c',
  danger: '#d1453b',
  info: '#0e7490',
  warning: '#b26a00',
  surface: '#ffffff',
};

/** Colors keyed to the six deal stages, in board order. */
export const STAGE_CHART_COLORS: Record<string, string> = {
  lead: CHART_COLORS.blue,
  qualified: CHART_COLORS.cyan,
  proposal: CHART_COLORS.gold,
  negotiation: CHART_COLORS.violet,
  won: CHART_COLORS.success,
  lost: CHART_COLORS.danger,
};

export const AXIS_LABEL = {
  color: CHART_COLORS.muted,
  fontFamily: 'Heebo, sans-serif',
  fontSize: 12,
};

export const TOOLTIP_STYLE = {
  backgroundColor: CHART_COLORS.surface,
  borderColor: CHART_COLORS.border,
  borderWidth: 1,
  textStyle: { color: CHART_COLORS.ink, fontFamily: 'Heebo, sans-serif' },
  extraCssText: 'box-shadow: 0 12px 32px rgba(16,24,40,0.14); border-radius: 12px;',
};

/** Shared "alive" animation defaults — fluid entrance, smooth data transitions. */
export const CHART_ANIMATION = {
  animationDuration: 1200,
  animationEasing: 'cubicOut' as const,
  animationDurationUpdate: 700,
  animationEasingUpdate: 'cubicInOut' as const,
};
