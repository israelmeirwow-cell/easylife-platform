import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/* Plays a pre-rendered 3D clip as a looping frame sequence on <canvas> —
   the Apple-product-page technique: real rendered 3D, zero WebGL, tiny CPU.
   Playback is ping-pong (forward then backward) so ANY clip loops seamlessly
   without needing a perfect loop from the video model.
   Under prefers-reduced-motion the middle frame renders as a still. */

export function FrameSequence({
  base,
  count,
  fps = 12,
  className = '',
  ext = 'jpg',
  ariaLabel,
}: {
  base: string;       // e.g. "/art/seq/growth/f_" (frames are f_01..f_NN)
  count: number;
  fps?: number;
  className?: string;
  ext?: string;
  ariaLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let disposed = false;
    const frames: HTMLImageElement[] = [];
    let loaded = 0;

    const draw = (img: HTMLImageElement) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      // cover-fit
      const scale = Math.max((w * dpr) / img.width, (h * dpr) / img.height);
      const dw = img.width * scale, dh = img.height * scale;
      ctx.drawImage(img, (w * dpr - dw) / 2, (h * dpr - dh) / 2, dw, dh);
    };

    let raf = 0;
    let start = 0;
    const frameMs = 1000 / fps;
    const cycle = 2 * (count - 1); // ping-pong period in frames

    const tick = (t: number) => {
      if (disposed) return;
      if (!start) start = t;
      const step = Math.floor((t - start) / frameMs) % cycle;
      const idx = step < count ? step : cycle - step; // forward then back
      const img = frames[idx];
      if (img?.complete) draw(img);
      raf = requestAnimationFrame(tick);
    };

    for (let i = 1; i <= count; i++) {
      const img = new Image();
      img.src = `${base}${String(i).padStart(2, '0')}.${ext}`;
      img.onload = () => {
        loaded++;
        if (disposed) return;
        if (reduce) {
          // static still: middle frame (or first loaded)
          if (i === Math.floor(count / 2) || loaded === count) draw(frames[Math.floor(count / 2)] ?? img);
        } else if (loaded === count) {
          raf = requestAnimationFrame(tick);
        }
      };
      frames.push(img);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [base, count, fps, ext, reduce]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    />
  );
}
