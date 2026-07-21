import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { formatNumber } from '@/lib/format';

export function RevenueCounter({
  pipelineValueShekels,
  wonThisMonthShekels,
  openDealsCount,
  loading,
}: {
  pipelineValueShekels: number;
  wonThisMonthShekels: number;
  openDealsCount: number;
  loading?: boolean;
}) {
  const v = useMotionValue(0);
  const rounded = useTransform(v, (x: number) => formatNumber(Math.round(x)));

  useEffect(() => {
    if (loading) return;
    const c = animate(v, pipelineValueShekels, { duration: 2, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [v, pipelineValueShekels, loading]);

  return (
    <div className="relative h-full overflow-hidden p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/50">שווי צינור מכירות</div>
          <div className="mt-2 flex items-baseline gap-1">
            <motion.span
              className="text-4xl font-semibold tracking-tight text-gradient tabular-nums"
              style={{ fontFamily: "'Space Grotesk',sans-serif" }}
            >
              {loading ? '···' : rounded}
            </motion.span>
            <span className="text-xs text-white/50">₪</span>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-200">
          <TrendingUp className="h-3 w-3" /> {openDealsCount} עסקאות פתוחות
          <ArrowUpRight className="h-3 w-3" />
        </div>
      </div>

      {/* sparkline (decorative) */}
      <svg viewBox="0 0 300 90" className="mt-6 w-full">
        <defs>
          <linearGradient id="rev-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7ff0ff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7ff0ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rev-stroke" x1="0" x2="1">
            <stop offset="0%" stopColor="#7ff0ff" />
            <stop offset="100%" stopColor="#e6edf3" />
          </linearGradient>
        </defs>
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
          d="M0,70 C30,55 55,60 80,45 C110,28 140,50 170,32 C200,16 235,40 260,22 C280,10 290,14 300,8"
          fill="none"
          stroke="url(#rev-stroke)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M0,70 C30,55 55,60 80,45 C110,28 140,50 170,32 C200,16 235,40 260,22 C280,10 290,14 300,8 L300,90 L0,90 Z"
          fill="url(#rev-fill)"
        />
      </svg>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] py-2">
          <div className="text-[10px] uppercase tracking-widest text-white/40">נסגר החודש</div>
          <div className="mt-1 text-sm font-medium tabular-nums" style={{ color: '#7ff0ff' }}>
            {loading ? '···' : `₪${formatNumber(wonThisMonthShekels)}`}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] py-2">
          <div className="text-[10px] uppercase tracking-widest text-white/40">עסקאות בצינור</div>
          <div className="mt-1 text-sm font-medium tabular-nums" style={{ color: '#e6edf3' }}>
            {loading ? '···' : openDealsCount}
          </div>
        </div>
      </div>
    </div>
  );
}
