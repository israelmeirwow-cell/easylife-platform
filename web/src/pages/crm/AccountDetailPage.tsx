import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  accountTimeline,
  getAccount,
  listActivities,
  listDeals,
  listTasks,
} from '../../lib/crm';
import { Avatar, Badge, Card, Spinner } from '../../components/ui';
import { DetailPanels } from '../../components/DetailPanels';
import { AddActivityForm } from '../../components/AddActivityForm';

const KIND_LABEL = { business: 'עסק', person: 'אדם פרטי' } as const;

function KeyField({ label, value, dir }: { label: string; value: string; dir?: 'ltr' }) {
  return (
    <div>
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-ink" dir={dir}>
        {value}
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/crm/accounts"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
    >
      <span aria-hidden>›</span> חזרה לחשבונות
    </Link>
  );
}

export default function AccountDetailPage() {
  const { id = '' } = useParams();

  const accountQ = useQuery({ queryKey: ['account', id], queryFn: () => getAccount(id) });
  const timelineQ = useQuery({
    queryKey: ['account-timeline', id],
    queryFn: () => accountTimeline(id),
  });
  const dealsQ = useQuery({
    queryKey: ['account-deals', id],
    queryFn: () => listDeals().then((all) => all.filter((d) => d.account_id === id)),
  });
  const tasksQ = useQuery({
    queryKey: ['account-tasks', id],
    queryFn: () => listTasks().then((all) => all.filter((t) => t.account_id === id)),
  });
  const activitiesQ = useQuery({
    queryKey: ['activities', { account_id: id }],
    queryFn: () => listActivities({ account_id: id }),
  });

  if (accountQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const a = accountQ.data;
  if (!a) {
    return (
      <div>
        <BackLink />
        <Card className="p-8 text-center text-sm text-muted">החשבון לא נמצא.</Card>
      </div>
    );
  }

  return (
    <div className="animate-drawer-in">
      <BackLink />

      <Card className="mb-5 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={a.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-ink">{a.name}</h1>
              <Badge
                tone={
                  a.kind === 'business'
                    ? 'bg-info-soft text-info'
                    : 'bg-surface-raised text-muted'
                }
              >
                {KIND_LABEL[a.kind]}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(a.tags ?? []).map((t) => (
                <Badge key={t} tone="bg-gold-soft text-gold-strong">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
          <KeyField label="תחום" value={a.industry || '—'} />
          <KeyField label="טלפון" value={a.phone || '—'} dir="ltr" />
          <KeyField label="מייל" value={a.email || '—'} dir="ltr" />
          <KeyField label="אתר" value={a.website || '—'} dir="ltr" />
        </div>

        {a.notes && (
          <div className="mt-4 rounded-xl border border-border bg-surface-raised/40 px-4 py-3 text-sm text-muted">
            {a.notes}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DetailPanels
          timeline={timelineQ.data ?? []}
          timelineLoading={timelineQ.isLoading}
          deals={dealsQ.data ?? []}
          tasks={tasksQ.data ?? []}
          activities={activitiesQ.data ?? []}
          activitiesLoading={activitiesQ.isLoading}
        />

        <div>
          <h3 className="mb-2 px-1 text-sm font-semibold text-ink">תיעוד מהיר</h3>
          <AddActivityForm
            accountId={id}
            invalidateKeys={[
              ['activities', { account_id: id }],
              ['account-timeline', id],
            ]}
          />
        </div>
      </div>
    </div>
  );
}
