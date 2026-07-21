/**
 * Hand-written typed fetch calls for the CRM surface, matching the API contract
 * (see /CLAUDE.md + the CRM rework brief). All endpoints are tenant-scoped via
 * the current user server-side (dev demo-tenant fallback). Money is agorot int.
 *
 * List endpoints may return either a bare array or `{ items: [...] }` — we
 * normalize both, matching how Feed.tsx already handles /api/feed.
 */

import { api } from './api';
import type {
  Account,
  Activity,
  Contact,
  DashboardSummary,
  Deal,
  DealStage,
  Task,
  TaskStatus,
  Ticket,
  TicketStatus,
} from './types';

function unwrap<T>(data: T[] | { items: T[] }): T[] {
  return Array.isArray(data) ? data : (data?.items ?? []);
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v != null && v !== '',
  ) as [string, string][];
  if (entries.length === 0) return '';
  return '?' + new URLSearchParams(entries).toString();
}

/* -------------------------------- Accounts ------------------------------- */

export function listAccounts(q?: string): Promise<Account[]> {
  return api<Account[] | { items: Account[] }>(`/api/accounts${qs({ q })}`).then(
    unwrap,
  );
}

export function getAccount(id: string): Promise<Account> {
  return api<Account>(`/api/accounts/${id}`);
}

export function createAccount(body: Partial<Account>): Promise<Account> {
  return api<Account>('/api/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateAccount(
  id: string,
  body: Partial<Account>,
): Promise<Account> {
  return api<Account>(`/api/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function accountTimeline(id: string): Promise<import('./types').EventItem[]> {
  return api<import('./types').EventItem[] | { items: import('./types').EventItem[] }>(
    `/api/accounts/${id}/timeline`,
  ).then(unwrap);
}

/* -------------------------------- Contacts ------------------------------- */

export function listContacts(q?: string): Promise<Contact[]> {
  return api<Contact[] | { items: Contact[] }>(`/api/contacts${qs({ q })}`).then(
    unwrap,
  );
}

export function getContact(id: string): Promise<Contact> {
  return api<Contact>(`/api/contacts/${id}`);
}

export function contactTimeline(id: string): Promise<import('./types').EventItem[]> {
  return api<import('./types').EventItem[] | { items: import('./types').EventItem[] }>(
    `/api/contacts/${id}/timeline`,
  ).then(unwrap);
}

/* --------------------------------- Deals --------------------------------- */

export function listDeals(opts?: {
  stage?: DealStage;
  pipeline?: string;
}): Promise<Deal[]> {
  return api<Deal[] | { items: Deal[] }>(
    `/api/deals${qs({ stage: opts?.stage, pipeline: opts?.pipeline })}`,
  ).then(unwrap);
}

export function getDeal(id: string): Promise<Deal> {
  return api<Deal>(`/api/deals/${id}`);
}

export function createDeal(body: Partial<Deal>): Promise<Deal> {
  return api<Deal>('/api/deals', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateDeal(id: string, body: Partial<Deal>): Promise<Deal> {
  return api<Deal>(`/api/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/* --------------------------------- Tasks --------------------------------- */

export function listTasks(opts?: {
  status?: TaskStatus;
  assignee?: string;
}): Promise<Task[]> {
  return api<Task[] | { items: Task[] }>(
    `/api/tasks${qs({ status: opts?.status, assignee: opts?.assignee })}`,
  ).then(unwrap);
}

export function createTask(body: Partial<Task>): Promise<Task> {
  return api<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateTask(id: string, body: Partial<Task>): Promise<Task> {
  return api<Task>(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/* -------------------------------- Tickets -------------------------------- */

export function listTickets(opts?: { status?: TicketStatus }): Promise<Ticket[]> {
  return api<Ticket[] | { items: Ticket[] }>(
    `/api/tickets${qs({ status: opts?.status })}`,
  ).then(unwrap);
}

export function createTicket(body: Partial<Ticket>): Promise<Ticket> {
  return api<Ticket>('/api/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateTicket(id: string, body: Partial<Ticket>): Promise<Ticket> {
  return api<Ticket>(`/api/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/* ------------------------------- Activities ------------------------------ */

export function listActivities(opts?: {
  contact_id?: string;
  account_id?: string;
  deal_id?: string;
}): Promise<Activity[]> {
  return api<Activity[] | { items: Activity[] }>(
    `/api/activities${qs({
      contact_id: opts?.contact_id,
      account_id: opts?.account_id,
      deal_id: opts?.deal_id,
    })}`,
  ).then(unwrap);
}

export function createActivity(body: Partial<Activity>): Promise<Activity> {
  return api<Activity>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/* ------------------------------- Leads ----------------------------------- */

export function listLeads(): Promise<import('./types').Lead[]> {
  return api<import('./types').Lead[] | { items: import('./types').Lead[] }>(
    '/api/leads',
  ).then(unwrap);
}

/* ------------------------------ Dashboard -------------------------------- */

export function dashboardSummary(): Promise<DashboardSummary> {
  return api<DashboardSummary>('/api/dashboard/summary');
}
