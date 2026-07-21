import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Users,
  Mail,
  Calendar,
  HardDrive,
  Hash,
  ShoppingBag,
  ShoppingCart,
  Receipt,
  CreditCard,
  Calculator,
  MessageCircle,
  Music,
  Plug,
  Check,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
  connectApp,
  connectionsCatalog,
  disconnectChannel,
  type ConnApp,
} from '@/lib/connections';

const ICONS: Record<string, LucideIcon> = {
  instagram: Camera,
  facebook: Users,
  mail: Mail,
  calendar: Calendar,
  'hard-drive': HardDrive,
  slack: Hash,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  receipt: Receipt,
  'credit-card': CreditCard,
  calculator: Calculator,
  'message-circle': MessageCircle,
  music: Music,
  plug: Plug,
};

const CATEGORY_ORDER = ['messaging', 'social', 'email', 'store', 'finance', 'productivity'];

export default function Connections() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['connections-catalog'], queryFn: connectionsCatalog });
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, ConnApp[]> = {};
    for (const a of data?.apps ?? []) (map[a.category] ??= []).push(a);
    return map;
  }, [data]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function onConnect(app: ConnApp) {
    setBusy(app.slug);
    try {
      const res = await connectApp(app.slug);
      if (res.mode === 'oauth' && res.redirect_url) {
        window.location.href = res.redirect_url; // real Composio consent
        return;
      }
      if (res.mode === 'native') flash(res.message_he || `${app.name_he}: חיבור ייעודי — נלווה אותך בהגדרה`);
      else flash(res.message_he || `${app.name_he} חובר`);
      await qc.invalidateQueries({ queryKey: ['connections-catalog'] });
    } catch {
      flash('החיבור נכשל — נסו שוב');
    } finally {
      setBusy(null);
    }
  }

  async function onDisconnect(app: ConnApp) {
    if (!app.channel_id) return;
    setBusy(app.slug);
    try {
      await disconnectChannel(app.channel_id);
      await qc.invalidateQueries({ queryKey: ['connections-catalog'] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink" style={{ fontFamily: "'Space Grotesk','Heebo',sans-serif" }}>
          חיבורים
        </h1>
        <p className="mt-1 text-sm text-muted">
          חברו את החשבונות של העסק בלחיצה אחת — הסוכנים יתחילו לראות את הפעילות אוטומטית.
        </p>
      </div>

      {data && !data.composio_configured && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-ink">
          <Plug className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <b>מצב דמו.</b> החיבורים דרך Composio יעברו למצב חי ברגע שיתווסף מפתח Composio בהגדרות השרת.
            החיבורים הייעודיים (וואטסאפ, חנות, חשבונית) עובדים ישירות דרכנו.
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      <div className="space-y-8">
        {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
          <section key={cat}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
              {data?.categories[cat] ?? cat}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grouped[cat].map((app) => {
                const Icon = ICONS[app.icon] ?? Plug;
                const isBusy = busy === app.slug;
                return (
                  <div
                    key={app.slug}
                    className="glass-card flex items-center gap-3 p-4 transition hover:shadow-raised"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-ink">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-ink">{app.name_he}</span>
                        {app.provider === 'native' && (
                          <span className="rounded-full bg-gold-soft px-1.5 py-0.5 text-[9px] font-medium text-gold-strong">
                            ישיר
                          </span>
                        )}
                      </div>
                      {app.note_he && <div className="truncate text-xs text-faint">{app.note_he}</div>}
                    </div>
                    {app.connected ? (
                      <button
                        onClick={() => onDisconnect(app)}
                        disabled={isBusy}
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-success/30 bg-success-soft px-2.5 py-1.5 text-xs font-medium text-success transition hover:border-danger/40 hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        מחובר
                      </button>
                    ) : (
                      <button
                        onClick={() => onConnect(app)}
                        disabled={isBusy}
                        className="shrink-0 rounded-lg bg-gradient-to-br from-[#0e8ba0] to-[#22b8cf] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'חיבור'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {toast && (
        <div
          role="alert"
          className="fixed bottom-24 start-1/2 z-50 -translate-x-1/2 animate-feed-in rounded-xl border border-border bg-surface px-5 py-3 text-sm text-ink shadow-pop"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
