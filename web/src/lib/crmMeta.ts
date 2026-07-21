import type {
  DealStage,
  LeadStage,
  TaskPriority,
  TaskStatus,
  TicketPriority,
  TicketStatus,
  ActivityKind,
} from './types';

/* ---------- Deal pipeline stages (ordered for the kanban board) ---------- */

export interface StageDef {
  key: DealStage;
  label: string;
  /** tailwind classes for the colored accent bar / dot */
  accent: string;
  /** text color for the header count pill */
  tone: string;
}

export const DEAL_STAGES: StageDef[] = [
  { key: 'lead', label: 'ליד', accent: 'bg-info', tone: 'text-info' },
  { key: 'qualified', label: 'מוכשר', accent: 'bg-gold', tone: 'text-gold-strong' },
  { key: 'proposal', label: 'הצעה', accent: 'bg-warning', tone: 'text-warning' },
  { key: 'negotiation', label: 'משא ומתן', accent: 'bg-charcoal', tone: 'text-ink' },
  { key: 'won', label: 'נסגר · זכייה', accent: 'bg-success', tone: 'text-success' },
  { key: 'lost', label: 'נסגר · הפסד', accent: 'bg-danger', tone: 'text-danger' },
];

export const DEAL_STAGE_LABEL: Record<DealStage, string> = Object.fromEntries(
  DEAL_STAGES.map((s) => [s.key, s.label]),
) as Record<DealStage, string>;

/* ------------------------------- Lead stages ----------------------------- */

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  new: 'חדש',
  contacted: 'נוצר קשר',
  qualified: 'מוכשר',
  won: 'זכייה',
  lost: 'הפסד',
};

export const LEAD_STAGE_TONE: Record<LeadStage, string> = {
  new: 'bg-info-soft text-info',
  contacted: 'bg-gold-soft text-gold-strong',
  qualified: 'bg-warning-soft text-warning',
  won: 'bg-success-soft text-success',
  lost: 'bg-danger-soft text-danger',
};

/* --------------------------------- Tasks --------------------------------- */

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'פתוח',
  in_progress: 'בתהליך',
  done: 'הושלם',
};

export const TASK_PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'נמוכה',
  normal: 'רגילה',
  high: 'גבוהה',
};

export const TASK_PRIORITY_TONE: Record<TaskPriority, string> = {
  low: 'bg-surface-raised text-muted',
  normal: 'bg-info-soft text-info',
  high: 'bg-danger-soft text-danger',
};

/* -------------------------------- Tickets -------------------------------- */

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'חדש',
  open: 'פתוח',
  pending: 'ממתין',
  resolved: 'נפתר',
  closed: 'סגור',
};

export const TICKET_STATUS_TONE: Record<TicketStatus, string> = {
  new: 'bg-info-soft text-info',
  open: 'bg-gold-soft text-gold-strong',
  pending: 'bg-warning-soft text-warning',
  resolved: 'bg-success-soft text-success',
  closed: 'bg-surface-raised text-muted',
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'נמוכה',
  normal: 'רגילה',
  high: 'גבוהה',
  urgent: 'דחוף',
};

export const TICKET_PRIORITY_TONE: Record<TicketPriority, string> = {
  low: 'bg-surface-raised text-muted',
  normal: 'bg-info-soft text-info',
  high: 'bg-warning-soft text-warning',
  urgent: 'bg-danger-soft text-danger',
};

/* ------------------------------- Activities ------------------------------ */

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  call: 'שיחה',
  meeting: 'פגישה',
  note: 'הערה',
  email: 'מייל',
  whatsapp: 'וואטסאפ',
};

export const ACTIVITY_KIND_ICON: Record<ActivityKind, string> = {
  call: '📞',
  meeting: '🤝',
  note: '📝',
  email: '✉️',
  whatsapp: '💬',
};
