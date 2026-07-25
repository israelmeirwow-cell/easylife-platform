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
  /** A HyperFrames composition has been written for this reel. */
  has_composition: boolean;
  composition_source: 'llm' | 'rules' | null;
  /** This server has the toolchain (node + ffmpeg) to export an MP4. */
  can_render: boolean;
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

/** Write the HyperFrames composition (the actual video) for a planned reel. */
export function composeVideoJob(
  id: string,
): Promise<{ id: string; composition_source: string; can_render: boolean }> {
  return api(`/api/video/jobs/${id}/compose`, { method: 'POST' });
}

/** Render the composition to a real MP4 (HyperFrames, local, no per-video cost). */
export function renderVideoJob(id: string): Promise<{ id: string; final_video_url: string }> {
  return api(`/api/video/jobs/${id}/render`, { method: 'POST' });
}

/** Self-playing composition — embed in an iframe to preview the reel live. */
export function videoPreviewUrl(id: string): string {
  return `/api/video/jobs/${id}/preview`;
}

export function videoMp4Url(id: string): string {
  return `/api/video/jobs/${id}/mp4`;
}
