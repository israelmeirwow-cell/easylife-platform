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
      navigate('/feed');
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
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold shadow-glow">
            <span className="h-2 w-2 rounded-full bg-ivory" />
          </span>
          <h1 className="text-2xl font-semibold tracking-wide text-gold">Easy Life</h1>
          <p className="text-sm text-muted">הסוכנים החכמים של העסק שלך</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-surface p-6 shadow-card"
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
              className="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-sm text-ivory placeholder:text-faint focus:border-gold/60"
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
              className="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-sm text-ivory placeholder:text-faint focus:border-gold/60"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-gold-hover disabled:opacity-60"
          >
            {loading ? 'מתחברים...' : 'כניסה'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/feed')}
            className="w-full rounded-xl border border-gold/40 px-4 py-2.5 text-sm font-medium text-gold transition hover:border-gold hover:shadow-glow"
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
