import { useEffect, useState, type FormEvent } from 'react';
import { Clapperboard, Download, Film, Play, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  composeVideoJob,
  createVideoJob,
  getVideoJob,
  listVideoJobs,
  renderVideoJob,
  videoMp4Url,
  videoPreviewUrl,
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
  // HyperFrames stage
  const [composing, setComposing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [previewKey, setPreviewKey] = useState(0); // bump to restart the reel

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
      setPreviewKey((k) => k + 1);
    } catch {
      setError('לא הצלחתי לטעון את הפרויקט.');
    }
  }

  /** Turn the plan into an actual HyperFrames video (free, local). */
  async function build() {
    if (!job || composing) return;
    setComposing(true);
    setError('');
    try {
      await composeVideoJob(job.id);
      setJob(await getVideoJob(job.id));
      setPreviewKey((k) => k + 1);
    } catch {
      setError('לא הצלחתי לבנות את הסרטון — נסו שוב.');
    } finally {
      setComposing(false);
    }
  }

  /** Export the composition to a downloadable MP4. */
  async function exportMp4() {
    if (!job || rendering) return;
    setRendering(true);
    setError('');
    try {
      await renderVideoJob(job.id);
      setJob(await getVideoJob(job.id));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? 'השרת מרנדר סרטון אחר כרגע — נסו שוב בעוד רגע.'
          : 'הייצוא ל-MP4 נכשל — נסו שוב.',
      );
    } finally {
      setRendering(false);
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

      {/* Result. The finished video comes FIRST — the storyboard is three tall
          cards of English prompt text, and burying the player under them meant
          people scrolled past it and concluded nothing had been generated. */}
      {job && (
        <div className="mt-6 flex flex-col">
          <div className="order-2 mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">התסריט של הסוכן</h2>
            {job.source === 'llm' && (
              <span className="flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-0.5 text-[11px] text-gold-strong">
                <Sparkles className="h-3 w-3" /> נכתב ע״י הסוכן
              </span>
            )}
          </div>

          <div className="order-3 grid gap-4 md:grid-cols-3">
            {job.scenes.map((s) => (
              <div key={s.id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gold-strong">
                    {ROLE_LABEL[s.role] ?? s.role}
                  </span>
                  <span className="text-[11px] text-muted">{s.duration}ש׳</span>
                </div>

                {/* keyframe strip — a real still appears here once a cinematic
                    engine (Higgsfield) is connected; until then keep it slim so
                    the prompts stay readable. */}
                <div
                  className={`mt-3 flex items-center justify-center rounded-xl border border-dashed border-border bg-surface-raised ${
                    s.keyframe_url ? 'aspect-[9/16]' : 'h-16'
                  }`}
                >
                  {s.keyframe_url ? (
                    <img src={s.keyframe_url} alt="" className="h-full w-full rounded-xl object-cover" />
                  ) : (
                    <Film className="h-5 w-5 text-faint" />
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

          {/* ---------- HyperFrames: build the actual video ---------- */}
          <div className="order-1 mb-6 rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-ink">הסרטון</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {job.has_composition
                    ? 'הסרטון מוכן — רץ כאן למטה. אפשר לייצא אותו כקובץ MP4.'
                    : 'הפכו את התסריט לסרטון אמיתי — נוצר אצלנו, בלי עלות לכל סרטון.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={build}
                  disabled={composing}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-[#0e8ba0] to-[#22b8cf] px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40"
                >
                  {composing ? <Spinner className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {composing ? 'בונה…' : job.has_composition ? 'בנה מחדש' : 'צרו את הסרטון'}
                </button>

                {job.has_composition && job.can_render && (
                  <button
                    onClick={exportMp4}
                    disabled={rendering}
                    className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-ink transition disabled:opacity-40"
                  >
                    {rendering ? <Spinner className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                    {rendering ? 'מייצא…' : 'ייצוא MP4'}
                  </button>
                )}

                {job.final_video_url && (
                  <a
                    href={videoMp4Url(job.id)}
                    download
                    className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-gold-strong transition"
                  >
                    <Download className="h-4 w-4" />
                    הורדה
                  </a>
                )}
              </div>
            </div>

            {job.has_composition && (
              <div className="mt-5 flex justify-center">
                {/* 1080x1920 composition scaled into a phone-sized frame */}
                <div
                  className="relative overflow-hidden rounded-2xl border border-border bg-black"
                  style={{ width: 270, height: 480 }}
                >
                  <iframe
                    key={previewKey}
                    src={videoPreviewUrl(job.id)}
                    title="תצוגה מקדימה של הסרטון"
                    sandbox="allow-scripts"
                    scrolling="no"
                    style={{
                      width: 1080,
                      height: 1920,
                      border: 0,
                      // Physical top/left + a matching origin on purpose: logical
                      // properties (insetInlineEnd) resolve against the RTL page
                      // while the transform does not, which parked the scaled
                      // iframe ~800px outside its frame — a permanently blank box.
                      transform: 'scale(0.25)',
                      transformOrigin: 'top left',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}
                  />
                </div>
              </div>
            )}

            {rendering && (
              <p className="mt-3 text-center text-xs text-muted">
                מרנדר את הסרטון — זה לוקח בערך חצי דקה.
              </p>
            )}
            {!job.can_render && job.has_composition && (
              <p className="mt-3 text-center text-xs text-muted">
                הסרטון רץ כאן חי. ייצוא לקובץ MP4 יופעל בשלב הבא (שרת רינדור ייעודי).
              </p>
            )}
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
