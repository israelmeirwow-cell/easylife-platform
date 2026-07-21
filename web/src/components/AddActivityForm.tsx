import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createActivity } from '../lib/crm';
import type { Activity, ActivityKind } from '../lib/types';
import { ACTIVITY_KIND_ICON, ACTIVITY_KIND_LABEL } from '../lib/crmMeta';
import { Button, Textarea } from './ui';

const KINDS: ActivityKind[] = ['note', 'call', 'meeting', 'email', 'whatsapp'];

export function AddActivityForm({
  contactId,
  accountId,
  dealId,
  invalidateKeys,
}: {
  contactId?: string;
  accountId?: string;
  dealId?: string;
  /** react-query keys to invalidate on success (e.g. the activities + timeline queries) */
  invalidateKeys: unknown[][];
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<ActivityKind>('note');
  const [body, setBody] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: Partial<Activity>) => createActivity(payload),
    onSuccess: () => {
      setBody('');
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
    },
  });

  function submit() {
    if (!body.trim()) return;
    mutation.mutate({
      kind,
      body: body.trim(),
      contact_id: contactId ?? null,
      account_id: accountId ?? null,
      deal_id: dealId ?? null,
      occurred_at: new Date().toISOString(),
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
              kind === k
                ? 'border-gold bg-gold-soft text-gold-strong'
                : 'border-border-strong bg-surface text-muted hover:bg-surface-raised'
            }`}
          >
            <span>{ACTIVITY_KIND_ICON[k]}</span>
            {ACTIVITY_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="תיעוד פעילות — מה קרה בשיחה, בפגישה או בהערה…"
      />
      <div className="mt-3 flex justify-end">
        <Button onClick={submit} disabled={!body.trim() || mutation.isPending} type="button">
          {mutation.isPending ? 'שומר…' : 'תיעוד פעילות'}
        </Button>
      </div>
    </div>
  );
}
