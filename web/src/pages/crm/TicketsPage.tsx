import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTicket, listTickets, updateTicket } from '../../lib/crm';
import type { Ticket, TicketPriority, TicketStatus } from '../../lib/types';
import {
  TICKET_PRIORITY_LABEL,
  TICKET_PRIORITY_TONE,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from '../../lib/crmMeta';
import { formatDate } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  SkeletonRow,
  Textarea,
} from '../../components/ui';

const STATUS_FILTERS: { key: TicketStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'הכול' },
  { key: 'new', label: 'חדש' },
  { key: 'open', label: 'פתוח' },
  { key: 'pending', label: 'ממתין' },
  { key: 'resolved', label: 'נפתר' },
  { key: 'closed', label: 'סגור' },
];

const NEXT_STATUS: Record<TicketStatus, TicketStatus> = {
  new: 'open',
  open: 'pending',
  pending: 'resolved',
  resolved: 'closed',
  closed: 'closed',
};

function NewTicketModal({
  open,
  onClose,
  onCreate,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (b: Partial<Ticket>) => void;
  saving: boolean;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('normal');

  function submit() {
    if (!subject.trim()) return;
    onCreate({
      subject: subject.trim(),
      body: body.trim() || null,
      priority,
      status: 'new',
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="טיקט חדש">
      <div className="space-y-4">
        <Field label="נושא">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="נושא הפנייה" autoFocus />
        </Field>
        <Field label="עדיפות">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
            <option value="low">נמוכה</option>
            <option value="normal">רגילה</option>
            <option value="high">גבוהה</option>
            <option value="urgent">דחוף</option>
          </Select>
        </Field>
        <Field label="תיאור">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="פירוט הבעיה או הבקשה…" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} type="button">
            ביטול
          </Button>
          <Button onClick={submit} disabled={saving || !subject.trim()} type="button">
            {saving ? 'שומר…' : 'פתיחת טיקט'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function TicketsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets', filter],
    queryFn: () => listTickets(filter === 'all' ? undefined : { status: filter }),
  });

  const advance = useMutation({
    mutationFn: (t: Ticket) => updateTicket(t.id, { status: NEXT_STATUS[t.status] }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tickets'] }),
  });

  const create = useMutation({
    mutationFn: (b: Partial<Ticket>) => createTicket(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setModalOpen(false);
    },
  });

  return (
    <div>
      <PageHeader
        title="טיקטים"
        subtitle="פניות שירות מכל הערוצים — עם סטטוס ועדיפות, כדי ששום לקוח לא ייפול בין הכיסאות."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <span className="text-base leading-none">+</span> טיקט חדש
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              filter === f.key
                ? 'border-gold bg-gold-soft text-gold-strong'
                : 'border-border-strong bg-surface text-muted hover:bg-surface-raised'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon="🎫"
          title="אין טיקטים"
          hint="כשלקוח יפנה בבקשת שירות, הטיקט יופיע כאן עם סטטוס ועדיפות."
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <article
              key={t.id}
              className="rounded-2xl border border-border bg-surface p-4 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{t.subject}</h3>
                    <Badge tone={TICKET_STATUS_TONE[t.status]}>
                      {TICKET_STATUS_LABEL[t.status]}
                    </Badge>
                    <Badge tone={TICKET_PRIORITY_TONE[t.priority]}>
                      {TICKET_PRIORITY_LABEL[t.priority]}
                    </Badge>
                  </div>
                  {t.body && <p className="mt-1.5 text-sm text-muted">{t.body}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-faint">
                    {t.contact_name && <span>{t.contact_name}</span>}
                    {t.channel_kind && <span>· {t.channel_kind}</span>}
                    <span>· נפתח {formatDate(t.created_at)}</span>
                  </div>
                </div>
                {t.status !== 'closed' && (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => advance.mutate(t)}
                    disabled={advance.isPending}
                    className="shrink-0"
                  >
                    קדם ל{TICKET_STATUS_LABEL[NEXT_STATUS[t.status]]}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <NewTicketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={(b) => create.mutate(b)}
        saving={create.isPending}
      />
    </div>
  );
}
