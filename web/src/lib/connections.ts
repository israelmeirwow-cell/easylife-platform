/** Connections ("חיבורים") client — Composio-backed apps + our native connectors. */

import { api } from './api';

export interface ConnApp {
  slug: string;
  name_he: string;
  category: string;
  category_he: string;
  provider: 'composio' | 'native';
  icon: string;
  note_he: string | null;
  status: string;
  connected: boolean;
  channel_id: string | null;
}

export interface Catalog {
  apps: ConnApp[];
  categories: Record<string, string>;
  composio_configured: boolean;
}

export function connectionsCatalog(): Promise<Catalog> {
  return api<Catalog>('/api/connections/catalog');
}

export interface ConnectResult {
  mode: 'native' | 'oauth' | 'demo';
  redirect_url?: string;
  channel_id?: string;
  message_he?: string;
}

export function connectApp(slug: string): Promise<ConnectResult> {
  return api<ConnectResult>(`/api/connections/${slug}/connect`, { method: 'POST' });
}

export function disconnectChannel(channelId: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/api/connections/${channelId}/disconnect`, { method: 'POST' });
}
