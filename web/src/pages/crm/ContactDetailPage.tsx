import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  contactTimeline,
  getContact,
  listActivities,
  listDeals,
  listTasks,
} from '../../lib/crm';
import { formatDate } from '../../lib/format';
import { Avatar, Badge, Card, Spinner } from '../../components/ui';
import { DetailPanels } from '../../components/DetailPanels';
import { AddActivityForm } from '../../components/AddActivityForm';

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
      to="/crm/contacts"
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-ink"
    >
      <span aria-hidden>›</span> חזרה לאנשי קשר
    </Link>
  );
}

export default function ContactDetailPage() {
  const { id = '' } = useParams();

  const contactQ = useQuery({ queryKey: ['contact', id], queryFn: () => getContact(id) });
  const timelineQ = useQuery({
    queryKey: ['contact-timeline', id],
    queryFn: () => contactTimeline(id),
  });
  const dealsQ = useQuery({
    queryKey: ['contact-deals', id],
    queryFn: () => listDeals().then((all) => all.filter((d) => d.contact_id === id)),
  });
  const tasksQ = useQuery({
    queryKey: ['contact-tasks', id],
    queryFn: () => listTasks().then((all) => all.filter((t) => t.contact_id === id)),
  });
  const activitiesQ = useQuery({
    queryKey: ['activities', { contact_id: id }],
    queryFn: () => listActivities({ contact_id: id }),
  });

  if (contactQ.isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const c = contactQ.data;
  if (!c) {
    return (
      <div>
        <BackLink />
        <Card className="p-8 text-center text-sm text-muted">איש הקשר לא נמצא.</Card>
      </div>
    );
  }

  return (
    <div className="animate-drawer-in">
      <BackLink />

      {/* Header */}
      <Card className="mb-5 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={c.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-ink">{c.name || 'ללא שם'}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(c.tags ?? []).map((t) => (
                <Badge key={t} tone="bg-gold-soft text-gold-strong">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
          <KeyField label="טלפון" value={c.phones?.[0] ?? '—'} dir="ltr" />
          <KeyField label="מייל" value={c.emails?.[0] ?? '—'} dir="ltr" />
          <KeyField label="נוצר" value={formatDate(c.created_at)} />
          <KeyField
            label="ערוצים"
            value={Object.keys(c.handles ?? {}).join(', ') || '—'}
          />
        </div>

        {c.notes && (
          <div className="mt-4 rounded-xl border border-border bg-surface-raised/40 px-4 py-3 text-sm text-muted">
            {c.notes}
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
            contactId={id}
            invalidateKeys={[
              ['activities', { contact_id: id }],
              ['contact-timeline', id],
            ]}
          />
        </div>
      </div>
    </div>
  );
}
