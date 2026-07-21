import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listContacts } from '../../lib/crm';
import { formatDate } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, Badge, EmptyState, SearchBox, SkeletonRow } from '../../components/ui';
import { useDebounced } from '../../lib/useDebounced';

export default function ContactsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 300);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', q],
    queryFn: () => listContacts(q || undefined),
  });

  return (
    <div>
      <PageHeader
        title="אנשי קשר"
        subtitle="כל מי שאי פעם דיבר עם העסק — נוצר אוטומטית מכל הודעה נכנסת וממוזג לפי טלפון או מייל."
        actions={<SearchBox value={search} onChange={setSearch} placeholder="חיפוש איש קשר…" />}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50 text-xs font-medium text-muted">
                <th className="px-4 py-3 text-start font-medium">שם</th>
                <th className="px-4 py-3 text-start font-medium">טלפון</th>
                <th className="px-4 py-3 text-start font-medium">מייל</th>
                <th className="px-4 py-3 text-start font-medium">תגיות</th>
                <th className="px-4 py-3 text-start font-medium">נוצר</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-4 py-3.5">
                          <SkeletonRow className="h-3.5 w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                : contacts.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/crm/contacts/${c.id}`)}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-raised/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={c.name} size="sm" />
                          <span className="font-medium text-ink">
                            {c.name || 'ללא שם'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted" dir="ltr">
                        <span className="block text-end">{c.phones?.[0] ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-muted" dir="ltr">
                        <span className="block text-end">{c.emails?.[0] ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags ?? []).slice(0, 3).map((t) => (
                            <Badge key={t} tone="bg-gold-soft text-gold-strong">
                              {t}
                            </Badge>
                          ))}
                          {(!c.tags || c.tags.length === 0) && (
                            <span className="text-faint">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{formatDate(c.created_at)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!isLoading && contacts.length === 0 && (
          <EmptyState
            icon="👤"
            title={q ? 'לא נמצאו אנשי קשר' : 'עדיין אין אנשי קשר'}
            hint={
              q
                ? 'נסו מונח חיפוש אחר.'
                : 'ברגע שתגיע הודעה ראשונה מלקוח, כרטיס איש קשר ייווצר כאן אוטומטית.'
            }
          />
        )}
      </div>
    </div>
  );
}
