import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Zap,
  Inbox,
  CheckCircle2,
  Layers,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from 'lucide-react';

const items: { icon: LucideIcon; label: string; to: string }[] = [
  { icon: LayoutGrid, label: 'סקירה', to: '/dashboard' },
  { icon: Zap, label: 'פיד חי', to: '/feed' },
  { icon: Inbox, label: 'אינבוקס', to: '/inbox' },
  { icon: CheckCircle2, label: 'אישורים', to: '/approvals' },
  { icon: Layers, label: 'עסקאות', to: '/crm/deals' },
  { icon: Users, label: 'אנשי קשר', to: '/crm/contacts' },
  { icon: BarChart3, label: 'תזרים', to: '/cashflow' },
  { icon: Settings, label: 'הגדרות', to: '/settings' },
];

export function Dock() {
  const mouseX = useMotionValue(Infinity);
  const { pathname } = useLocation();
  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-end gap-2 rounded-3xl border border-border bg-surface/90 p-2.5 backdrop-blur-2xl"
      style={{ boxShadow: '0 30px 80px -20px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.7)' }}
      aria-label="סרגל פעולות"
    >
      {items.map((it) => (
        <DockIcon
          key={it.to}
          mouseX={mouseX}
          Icon={it.icon}
          label={it.label}
          to={it.to}
          active={pathname === it.to || pathname.startsWith(it.to + '/')}
        />
      ))}
    </motion.div>
  );
}

function DockIcon({
  mouseX,
  Icon,
  label,
  to,
  active,
}: {
  mouseX: MotionValue<number>;
  Icon: LucideIcon;
  label: string;
  to: string;
  active: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const distance = useTransform(mouseX, (v) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return v - rect.x - rect.width / 2;
  });
  const size = useSpring(useTransform(distance, [-150, 0, 150], [44, 68, 44]), {
    stiffness: 200,
    damping: 18,
  });
  return (
    <motion.button
      ref={ref}
      onClick={() => navigate(to)}
      style={{ width: size, height: size }}
      aria-label={label}
      className={`group relative flex items-center justify-center rounded-2xl border bg-gradient-to-b from-surface-raised to-surface transition-colors hover:border-gold/40 ${
        active ? 'border-gold/50 text-gold-strong' : 'border-border text-ink'
      }`}
    >
      <Icon className="h-4 w-4" />
      {active && (
        <span
          className="absolute -bottom-1 h-1 w-1 rounded-full bg-gold"
          style={{ boxShadow: '0 0 8px #0e8ba0' }}
        />
      )}
      <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md border border-border bg-ink px-2 py-1 text-[10px] text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </motion.button>
  );
}
