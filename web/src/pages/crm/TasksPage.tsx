import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTask, listTasks, updateTask } from '../../lib/crm';
import type { Task, TaskPriority, TaskStatus } from '../../lib/types';
import {
  TASK_PRIORITY_LABEL,
  TASK_PRIORITY_TONE,
  TASK_STATUS_LABEL,
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
} from '../../components/ui';

const STATUS_ORDER: TaskStatus[] = ['open', 'in_progress', 'done'];

function TaskRow({
  task,
  onToggle,
  busy,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  busy: boolean;
}) {
  const done = task.status === 'done';
  const overdue =
    !done && task.due_at != null && new Date(task.due_at).getTime() < Date.now();
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggle(task)}
        aria-label={done ? 'סמן כלא הושלם' : 'סמן כהושלם'}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          done
            ? 'border-success bg-success text-white'
            : 'border-border-strong bg-surface hover:border-gold'
        }`}
      >
        {done && (
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-sm font-medium ${
            done ? 'text-faint line-through' : 'text-ink'
          }`}
        >
          {task.title}
        </div>
        {(task.contact_name || task.account_name || task.deal_title || task.due_at) && (
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {task.contact_name && <span>{task.contact_name}</span>}
            {task.account_name && <span>{task.account_name}</span>}
            {task.deal_title && <span>· {task.deal_title}</span>}
            {task.due_at && (
              <span className={overdue ? 'text-danger' : ''}>
                יעד {formatDate(task.due_at)}
              </span>
            )}
          </div>
        )}
      </div>
      <Badge tone={TASK_PRIORITY_TONE[task.priority]}>
        {TASK_PRIORITY_LABEL[task.priority]}
      </Badge>
    </div>
  );
}

function NewTaskModal({
  open,
  onClose,
  onCreate,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (b: Partial<Task>) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [due, setDue] = useState('');

  function submit() {
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      priority,
      status: 'open',
      due_at: due ? new Date(due).toISOString() : null,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="משימה חדשה">
      <div className="space-y-4">
        <Field label="כותרת">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="מה צריך לעשות?" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="עדיפות">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">נמוכה</option>
              <option value="normal">רגילה</option>
              <option value="high">גבוהה</option>
            </Select>
          </Field>
          <Field label="תאריך יעד">
            <Input type="date" dir="ltr" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} type="button">
            ביטול
          </Button>
          <Button onClick={submit} disabled={saving || !title.trim()} type="button">
            {saving ? 'שומר…' : 'יצירת משימה'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function TasksPage() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => listTasks(),
  });

  const toggle = useMutation({
    mutationFn: (t: Task) =>
      updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' }),
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const prev = qc.getQueryData<Task[]>(['tasks']);
      qc.setQueryData<Task[]>(['tasks'], (old) =>
        (old ?? []).map((x) =>
          x.id === t.id ? { ...x, status: x.status === 'done' ? 'open' : 'done' } : x,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['tasks'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const create = useMutation({
    mutationFn: (b: Partial<Task>) => createTask(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setModalOpen(false);
    },
  });

  const grouped: Record<TaskStatus, Task[]> = {
    open: [],
    in_progress: [],
    done: [],
  };
  for (const t of tasks) (grouped[t.status] ?? grouped.open).push(t);

  return (
    <div>
      <PageHeader
        title="משימות"
        subtitle="כל מה שצריך להיעשות — מקובץ לפי סטטוס. סמנו תיבה כדי לסגור משימה."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <span className="text-base leading-none">+</span> משימה חדשה
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="✅"
          title="אין משימות פתוחות"
          hint="צרו משימה ראשונה כדי לעקוב אחרי מה שצריך להיעשות."
          action={
            <Button onClick={() => setModalOpen(true)} type="button">
              יצירת משימה
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.map((status) => {
            const list = grouped[status];
            if (list.length === 0) return null;
            return (
              <section key={status}>
                <div className="mb-2 flex items-center gap-2 px-1">
                  <h2 className="text-sm font-semibold text-ink">
                    {TASK_STATUS_LABEL[status]}
                  </h2>
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
                    {list.length}
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} onToggle={(x) => toggle.mutate(x)} busy={toggle.isPending} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <NewTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={(b) => create.mutate(b)}
        saving={create.isPending}
      />
    </div>
  );
}
