// Types mirroring the brain schema (see /CLAUDE.md — all tables carry tenant_id, created_at)

export type ActorType = 'agent' | 'human' | 'system' | 'contact';

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'executed'
  | 'failed';

/** Append-only events table — the live feed, the contact timeline, the agent context. */
export interface EventItem {
  id: number;
  tenant_id?: string;
  actor_type: ActorType;
  actor_id: string | null;
  /** `entity.verb` form: message.received, lead.seen, approval.requested, ... */
  verb: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  ts: string; // timestamptz UTC ISO string
}

export interface Contact {
  id: string;
  tenant_id?: string;
  name: string | null;
  phones: string[];
  emails: string[];
  handles: Record<string, string>;
  tags: string[];
  notes: string | null;
  custom: Record<string, unknown>;
  created_at: string;
}

export interface Lead {
  id: string;
  tenant_id?: string;
  contact_id: string;
  /** joined convenience field from the API when available */
  contact_name?: string | null;
  stage: LeadStage;
  /** Money in agorot (int) per platform convention */
  value_agorot: number | null;
  source_channel: string | null;
  owner: string | null;
  created_at: string;
}

export interface Approval {
  id: string;
  tenant_id?: string;
  requested_by_agent: string;
  action_type: string;
  payload: Record<string, unknown>;
  preview_text: string;
  status: ApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  executed_at: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Inbox — conversations + messages (tenant-scoped)                    */
/* ------------------------------------------------------------------ */

export type ConversationStatus = 'open' | 'pending' | 'closed';
export type ConversationAssignee = 'agent' | 'human';

/** GET /api/conversations */
export interface ConversationOut {
  id: string;
  contact_id: string;
  channel_id: string | null;
  status: ConversationStatus;
  assignee: ConversationAssignee;
  last_msg_at: string | null;
  created_at: string;
  contact_name: string | null;
  preview: string | null;
  channel_kind: string | null;
}

export type MessageDirection = 'in' | 'out';
export type MessageSenderType = 'contact' | 'agent' | 'human';

/** GET /api/conversations/{id}/messages */
export interface MessageOut {
  id: string;
  conversation_id: string;
  direction: MessageDirection;
  sender_type: MessageSenderType;
  body: string | null;
  media: Record<string, unknown>;
  channel_msg_id: string | null;
  ts: string;
}

/* ------------------------------------------------------------------ */
/* CRM models                                                          */
/* ------------------------------------------------------------------ */

export type AccountKind = 'business' | 'person';

export interface Account {
  id: string;
  tenant_id?: string;
  name: string;
  kind: AccountKind;
  phone: string | null;
  email: string | null;
  website: string | null;
  industry: string | null;
  owner_user_id: string | null;
  tags: string[];
  notes: string | null;
  custom: Record<string, unknown>;
  created_at: string;
}

export type DealStage =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export interface Deal {
  id: string;
  tenant_id?: string;
  title: string;
  account_id: string | null;
  account_name?: string | null;
  contact_id: string | null;
  contact_name?: string | null;
  pipeline: string;
  stage: DealStage;
  /** Money in agorot (int) */
  value_agorot: number;
  currency: string;
  expected_close: string | null;
  owner_user_id: string | null;
  source_channel: string | null;
  custom: Record<string, unknown>;
  created_at: string;
}

export type TaskStatus = 'open' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface Task {
  id: string;
  tenant_id?: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  contact_id: string | null;
  contact_name?: string | null;
  account_id: string | null;
  account_name?: string | null;
  deal_id: string | null;
  deal_title?: string | null;
  assignee_user_id: string | null;
  created_by: string | null;
  created_at: string;
}

export type TicketStatus = 'new' | 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  tenant_id?: string;
  subject: string;
  body: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  contact_id: string | null;
  contact_name?: string | null;
  channel_kind: string | null;
  assignee_user_id: string | null;
  created_at: string;
}

export type ActivityKind = 'call' | 'meeting' | 'note' | 'email' | 'whatsapp';

export interface Activity {
  id: string;
  tenant_id?: string;
  kind: ActivityKind;
  body: string;
  contact_id: string | null;
  account_id: string | null;
  deal_id: string | null;
  actor_user_id: string | null;
  occurred_at: string;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/* Dashboard summary                                                   */
/* ------------------------------------------------------------------ */

export interface DealsByStageBucket {
  stage: DealStage;
  count: number;
  value_agorot: number;
}

export interface DashboardSummary {
  contacts_count: number;
  leads_count: number;
  open_deals_count: number;
  pipeline_value_agorot: number;
  deals_by_stage: DealsByStageBucket[];
  tasks_open_count: number;
  tickets_open_count: number;
  won_this_month_agorot: number;
}

/* ------------------------------------------------------------------ */
/* Dashboard analytics (rich business aggregates)                      */
/* ------------------------------------------------------------------ */

export interface MonthBucket {
  month: string; // "YYYY-MM"
  created_count: number;
  won_count: number;
  won_agorot: number;
}

export interface CountBucket {
  key: string;
  count: number;
}

export interface TopDeal {
  id: string;
  title: string;
  stage: DealStage;
  value_agorot: number;
}

export interface DashboardAnalytics {
  monthly: MonthBucket[];
  leads_funnel: CountBucket[];
  tickets_by_status: CountBucket[];
  activity_by_weekday: CountBucket[];
  top_open_deals: TopDeal[];
  won_total_agorot: number;
  avg_deal_agorot: number;
  win_rate_pct: number;
}
