import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      navigate('/dashboard');
    } catch {
      setToast('ההתחברות נכשלה — בדקו את האימייל והסיסמה ונסו שוב');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-charcoal shadow-card">
            <span className="h-3 w-3 rounded-full bg-gold" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Easy<span className="text-gold-strong"> Life</span>
          </h1>
          <p className="text-sm text-muted">הסוכנים החכמים של העסק שלך</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-raised"
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-muted">
              אימייל
            </label>
            <input
              id="email"
              type="email"
              required
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-faint transition focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
              placeholder="you@business.co.il"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-muted">
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              required
              dir="ltr"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-faint transition focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-gold-hover disabled:opacity-60"
          >
            {loading ? 'מתחברים...' : 'כניסה'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-xl border border-border-strong px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-surface-raised"
          >
            כניסת דמו
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-faint">
          עסק אחד. מוח אחד. שקט בראש.
        </p>
      </div>

      {/* error toast */}
      {toast && (
        <div
          role="alert"
          className="fixed bottom-6 start-1/2 z-50 translate-x-1/2 animate-feed-in rounded-xl border border-danger/40 bg-surface px-5 py-3 text-sm text-danger shadow-card"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
