/** CEO agent client — the central brain's executive layer. */

import { api } from './api';

export interface CeoRecommendation {
  title: string;
  why: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CeoBrief {
  headline: string;
  generated_at: string;
  highlights: string[];
  risks: string[];
  recommendations: CeoRecommendation[];
  focus_now: string[];
  source: 'rules' | 'llm';
}

export function ceoBrief(): Promise<CeoBrief> {
  return api<CeoBrief>('/api/ceo/brief');
}

export function ceoAsk(question: string): Promise<{ answer: string; source: string }> {
  return api<{ answer: string; source: string }>('/api/ceo/ask', {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
