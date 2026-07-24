/** Video agent client — the reel planner (blueprint §4 step 1). */

import { api } from './api';

export type SceneRole = 'hook' | 'product' | 'cta';

export interface VideoScene {
  id: string;
  index: number;
  role: SceneRole;
  status: string;
  keyframe_url: string | null;
  video_url: string | null;
  keyframe_prompt: string;
  video_prompt: string;
  camera: string[];
  duration: number | null;
  overlay_text?: string | null;
}

export interface VideoJob {
  id: string;
  brief: string;
  status: string;
  source: 'llm' | 'rules' | null;
  product_ref: Record<string, unknown>;
  final_video_url: string | null;
  created_at: string | null;
  scenes: VideoScene[];
}

export interface VideoJobSummary {
  id: string;
  brief: string;
  status: string;
  source: 'llm' | 'rules' | null;
  scene_count: number;
  created_at: string | null;
}

export function createVideoJob(brief: string, productName?: string): Promise<VideoJob> {
  return api<VideoJob>('/api/video/jobs', {
    method: 'POST',
    body: JSON.stringify({ brief, product_name: productName || null }),
  });
}

export function listVideoJobs(): Promise<VideoJobSummary[]> {
  return api<VideoJobSummary[]>('/api/video/jobs');
}

export function getVideoJob(id: string): Promise<VideoJob> {
  return api<VideoJob>(`/api/video/jobs/${id}`);
}
