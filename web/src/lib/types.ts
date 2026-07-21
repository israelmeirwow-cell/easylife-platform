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
