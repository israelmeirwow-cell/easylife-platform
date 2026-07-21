/** Shared ECharts styling for the light Easy Life theme. */

export const CHART_COLORS = {
  gold: '#C9A96A',
  goldStrong: '#A9843F',
  charcoal: '#22262F',
  ink: '#1A1D24',
  muted: '#6B7280',
  faint: '#9AA1AD',
  border: '#E7E9EE',
  success: '#2F9E6F',
  danger: '#D1483F',
  info: '#3576C9',
  warning: '#D9962B',
  surface: '#FFFFFF',
};

/** Colors keyed to the six deal stages, in board order. */
export const STAGE_CHART_COLORS: Record<string, string> = {
  lead: CHART_COLORS.info,
  qualified: CHART_COLORS.gold,
  proposal: CHART_COLORS.warning,
  negotiation: CHART_COLORS.charcoal,
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
