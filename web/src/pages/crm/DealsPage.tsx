import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { createDeal, listDeals, updateDeal } from '../../lib/crm';
import type { Deal, DealStage } from '../../lib/types';
import { DEAL_STAGES } from '../../lib/crmMeta';
import { formatAgorot, formatDate } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import { Avatar, Badge, Button, Field, Input, Modal, Select, SkeletonRow } from '../../components/ui';

/* ------------------------------ Deal card -------------------------------- */

function DealCardBody({ deal, dragging = false }: { deal: Deal; dragging?: boolean }) {
  const who = deal.account_name || deal.contact_name;
  return (
    <div
      className={`rounded-xl border border-border bg-surface p-3 shadow-card ${
        dragging ? 'rotate-2 shadow-pop' : ''
      }`}
    >
      <div className="mb-1.5 line-clamp-2 text-sm font-semibold text-ink">{deal.title}</div>
      {who && <div className="mb-2 truncate text-xs text-muted">{who}</div>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gold-strong">
          {formatAgorot(deal.value_agorot)}
        </span>
        {deal.expected_close && (
          <span className="text-[11px] text-faint">{formatDate(deal.expected_close)}</span>
        )}
      </div>
      {deal.owner_user_id && (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-border pt-2">
          <Avatar name={deal.owner_user_id} size="sm" />
          <span className="truncate text-[11px] text-muted">{deal.owner_user_id}</span>
        </div>
      )}
    </div>
  );
}

function DraggableDeal({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab touch-none active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <DealCardBody deal={deal} />
    </div>
  );
}

/* -------------------------------- Column --------------------------------- */

function Column({
  stage,
  label,
  accent,
  tone,
  deals,
}: {
  stage: DealStage;
  label: string;
  accent: string;
  tone: string;
  deals: Deal[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((s, d) => s + (d.value_agorot ?? 0), 0);
  return (
    <section className="flex w-72 shrink-0 flex-col">
      <header className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
          <h2 className="text-sm font-semibold text-ink">{label}</h2>
          <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
            {deals.length}
          </span>
        </div>
        <span className={`text-xs font-medium ${tone}`}>{formatAgorot(total)}</span>
      </header>
      <div
        ref={setNodeRef}
        className={`min-h-32 flex-1 space-y-2.5 rounded-2xl border border-dashed p-2 transition-colors ${
          isOver ? 'border-gold bg-gold-soft' : 'border-border bg-surface-raised/40'
        }`}
      >
        {deals.map((d) => (
          <DraggableDeal key={d.id} deal={d} />
        ))}
        {deals.length === 0 && (
          <div className="flex h-24 items-center justify-center text-xs text-faint">
            אין עסקאות
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ New deal form ---------------------------- */

const STAGE_OPTIONS = DEAL_STAGES.map((s) => ({ value: s.key, label: s.label }));

function NewDealModal({
  open,
  onClose,
  onCreate,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (body: Partial<Deal>) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stage, setStage] = useState<DealStage>('lead');
  const [owner, setOwner] = useState('');
  const [company, setCompany] = useState('');

  function submit() {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      value_agorot: Math.round((parseFloat(value) || 0) * 100),
      stage,
      owner_user_id: owner.trim() || null,
      account_name: company.trim() || null,
      currency: 'ILS',
      pipeline: 'sales',
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="עסקה חדשה">
      <div className="space-y-4">
        <Field label="כותרת העסקה">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: חבילת שירות שנתית" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="שווי (₪)">
            <Input
              type="number"
              inputMode="decimal"
              dir="ltr"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="שלב">
            <Select value={stage} onChange={(e) => setStage(e.target.value as DealStage)}>
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="חשבון / איש קשר">
          <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="שם החברה או הלקוח" />
        </Field>
        <Field label="אחראי">
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="שם האחראי" />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} type="button">
            ביטול
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim()} type="button">
            {saving ? 'שומר…' : 'יצירת עסקה'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------- Page ---------------------------------- */

export default function DealsPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => listDeals(),
  });

  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) =>
      updateDeal(id, { stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ['deals'] });
      const prev = qc.getQueryData<Deal[]>(['deals']);
      qc.setQueryData<Deal[]>(['deals'], (old) =>
        (old ?? []).map((d) => (d.id === id ? { ...d, stage } : d)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['deals'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });

  const create = useMutation({
    mutationFn: (body: Partial<Deal>) => createDeal(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] });
      setModalOpen(false);
    },
  });

  const byStage = useMemo(() => {
    const map: Record<DealStage, Deal[]> = {
      lead: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      won: [],
      lost: [],
    };
    for (const d of deals) (map[d.stage] ?? map.lead).push(d);
    return map;
  }, [deals]);

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const target = String(over.id) as DealStage;
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === target) return;
    move.mutate({ id, stage: target });
  }

  return (
    <div>
      <PageHeader
        title="עסקאות"
        subtitle="לוח קנבן של צינור המכירות — גררו כרטיס בין שלבים כדי לעדכן את מצב העסקה."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <span className="text-base leading-none">+</span> עסקה חדשה
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {DEAL_STAGES.map((s) => (
            <div key={s.key} className="w-72 shrink-0 space-y-2.5">
              <SkeletonRow className="h-5 w-40" />
              <SkeletonRow className="h-24 w-full rounded-xl" />
              <SkeletonRow className="h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="flex gap-4 overflow-x-auto pb-3">
            {DEAL_STAGES.map((s) => (
              <Column
                key={s.key}
                stage={s.key}
                label={s.label}
                accent={s.accent}
                tone={s.tone}
                deals={byStage[s.key]}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDeal ? (
              <div className="w-64">
                <DealCardBody deal={activeDeal} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {deals.length === 0 && !isLoading && (
        <div className="mt-4">
          <Badge>טיפ: צרו עסקה ראשונה כדי להתחיל למלא את הצינור</Badge>
        </div>
      )}

      <NewDealModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={(body) => create.mutate(body)}
        saving={create.isPending}
      />
    </div>
  );
}
