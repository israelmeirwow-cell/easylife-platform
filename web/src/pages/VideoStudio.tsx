import { useEffect, useState, type FormEvent } from 'react';
import { Clapperboard, Film, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui';
import {
  createVideoJob,
  getVideoJob,
  listVideoJobs,
  type SceneRole,
  type VideoJob,
  type VideoJobSummary,
} from '@/lib/video';

const ROLE_LABEL: Record<SceneRole, string> = {
  hook: 'הוק · עוצר גלילה',
  product: 'המוצר',
  cta: 'קריאה לפעולה',
};

const EXAMPLES = [
  'סרטון קצר ואפטיטי לאינסטגרם למאפייה — להבליט קרואסון חמאה שיוצא מהתנור',
  'רילס לחנות תכשיטים — טבעת זהב עם יהלום, אווירה יוקרתית ומוארת',
  'סרטון לבית קפה — כוס קפוצ׳ינו עם לאטה-ארט, בוקר חמים',
];

function prettyCamera(c: string): string {
  return c.replace(/_/g, ' ');
}

export default function VideoStudio() {
  const [brief, setBrief] = useState('');
  const [product, setProduct] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState<VideoJob | null>(null);
  const [recent, setRecent] = useState<VideoJobSummary[]>([]);

  async function refreshRecent() {
    try {
      setRecent(await listVideoJobs());
    } catch {
      /* non-fatal */
    }
  }

  useEffect(() => {
    refreshRecent();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const b = brief.trim();
    if (!b || busy) return;
    setBusy(true);
    setError('');
    setJob(null);
    try {
      const result = await createVideoJob(b, product.trim() || undefined);
      setJob(result);
      refreshRecent();
    } catch {
      setError('לא הצלחתי לתכנן כרגע — נסו שוב בעוד רגע.');
    } finally {
      setBusy(false);
    }
  }

  async function openJob(id: string) {
    setError('');
    try {
      const j = await getVideoJob(id);
      setJob(j);
      setBrief(j.brief);
    } catch {
      setError('לא הצלחתי לטעון את הפרויקט.');
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0e8ba0] to-[#22b8cf] text-white">
          <Clapperboard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
            סטודיו וידאו
          </h1>
          <p className="text-sm text-muted">
            תארו מה תרצו — הסוכן מתכנן reel קולנועי של 3 סצנות (הוק · מוצר · קריאה לפעולה).
          </p>
        </div>
      </div>

      {/* brief form */}
      <form onSubmit={submit} className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <label className="mb-1.5 block text-xs font-medium text-muted">מה לצלם? (בעברית, חופשי)</label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="למשל: סרטון אפטיטי לאינסטגרם למאפייה שלי — קרואסון חמאה שיוצא מהתנור, אווירת בוקר חמימה"
          className="w-full resize-none rounded-xl border border-border bg-surface-raised px-3.5 py-3 text-sm text-ink outline-none placeholder:text-faint focus:border-gold/50"
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="שם המוצר (אופציונלי)"
            className="flex-1 rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-gold/50"
          />
          <button
            type="submit"
            disabled={busy || !brief.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#0e8ba0] to-[#22b8cf] px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40"
          >
            {busy ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {busy ? 'הסוכן מתכנן…' : 'תכנן לי reel'}
          </button>
        </div>

        {!job && !busy && (
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setBrief(ex)}
                className="rounded-full border border-border bg-surface-raised px-3 py-1 text-xs text-muted transition hover:text-ink"
              >
                {ex.slice(0, 42)}…
              </button>
            ))}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </form>

      {/* result storyboard */}
      {job && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">התסריט של הסוכן</h2>
            {job.source === 'llm' && (
              <span className="flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-0.5 text-[11px] text-gold-strong">
                <Sparkles className="h-3 w-3" /> נכתב ע״י הסוכן
              </span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {job.scenes.map((s) => (
              <div key={s.id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gold-strong">
                    {ROLE_LABEL[s.role] ?? s.role}
                  </span>
                  <span className="text-[11px] text-muted">{s.duration}ש׳</span>
                </div>

                {/* keyframe placeholder — real still renders when the engine is wired */}
                <div className="mt-3 flex aspect-[9/16] items-center justify-center rounded-xl border border-dashed border-border bg-surface-raised">
                  {s.keyframe_url ? (
                    <img src={s.keyframe_url} alt="" className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    <Film className="h-7 w-7 text-faint" />
                  )}
                </div>

                <div className="mt-3 space-y-2 text-xs leading-relaxed">
                  <div>
                    <div className="mb-0.5 font-medium text-muted">פריים</div>
                    <p className="text-ink">{s.keyframe_prompt}</p>
                  </div>
                  <div>
                    <div className="mb-0.5 font-medium text-muted">תנועה</div>
                    <p className="text-ink">{s.video_prompt}</p>
                  </div>
                  {s.camera?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {s.camera.map((c) => (
                        <span key={c} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted">
                          {prettyCamera(c)}
                        </span>
                      ))}
                    </div>
                  )}
                  {s.role === 'cta' && s.overlay_text && (
                    <div className="mt-1 rounded-lg bg-gold-soft px-2.5 py-1.5 text-[12px] text-gold-strong">
                      טקסט על המסך: {s.overlay_text}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* render-pending note (honest about what's next) */}
          <div className="mt-4 rounded-xl border border-border bg-surface-raised px-4 py-3 text-xs text-muted">
            ✅ התוכנית מוכנה. <span className="text-ink">ג׳נרוט הווידאו עצמו</span> (הפיכת כל סצנה לסרטון קולנועי)
            יתחבר כאן ברגע שנחבר את מנוע הרינדור — HyperFrames לשכבת המיתוג ו-Higgsfield לצילום הקולנועי.
          </div>
        </div>
      )}

      {/* recent jobs */}
      {recent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-ink">תוכניות אחרונות</h2>
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {recent.map((r) => (
              <button
                key={r.id}
                onClick={() => openJob(r.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition hover:bg-surface-raised"
              >
                <span className="line-clamp-1 flex-1 text-sm text-ink">{r.brief}</span>
                <span className="shrink-0 text-[11px] text-muted">{r.scene_count} סצנות</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
