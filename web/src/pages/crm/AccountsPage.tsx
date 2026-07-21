import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createAccount, listAccounts } from '../../lib/crm';
import type { Account, AccountKind } from '../../lib/types';
import { formatDate } from '../../lib/format';
import { PageHeader } from '../../components/PageHeader';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  SearchBox,
  Select,
  SkeletonRow,
} from '../../components/ui';
import { useDebounced } from '../../lib/useDebounced';

const KIND_LABEL: Record<AccountKind, string> = { business: 'עסק', person: 'אדם פרטי' };

function NewAccountModal({
  open,
  onClose,
  onCreate,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (b: Partial<Account>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('business');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [industry, setIndustry] = useState('');

  function submit() {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      kind,
      phone: phone.trim() || null,
      email: email.trim() || null,
      industry: industry.trim() || null,
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="חשבון חדש">
      <div className="space-y-4">
        <Field label="שם">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם החברה או האדם" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="סוג">
            <Select value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              <option value="business">עסק</option>
              <option value="person">אדם פרטי</option>
            </Select>
          </Field>
          <Field label="תחום">
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="לדוגמה: קמעונאות" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="טלפון">
            <Input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" />
          </Field>
          <Field label="מייל">
            <Input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@company.co.il" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} type="button">
            ביטול
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim()} type="button">
            {saving ? 'שומר…' : 'יצירת חשבון'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function AccountsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const q = useDebounced(search, 300);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', q],
    queryFn: () => listAccounts(q || undefined),
  });

  const create = useMutation({
    mutationFn: (b: Partial<Account>) => createAccount(b),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      setModalOpen(false);
    },
  });

  return (
    <div>
      <PageHeader
        title="חשבונות"
        subtitle="הארגונים והלקוחות של העסק — כל חשבון מרכז אנשי קשר, עסקאות ופעילות תחת גג אחד."
        actions={
          <div className="flex items-center gap-2">
            <SearchBox value={search} onChange={setSearch} placeholder="חיפוש חשבון…" />
            <Button onClick={() => setModalOpen(true)}>
              <span className="text-base leading-none">+</span> חדש
            </Button>
          </div>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-start text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/50 text-xs font-medium text-muted">
                <th className="px-4 py-3 text-start font-medium">שם</th>
                <th className="px-4 py-3 text-start font-medium">סוג</th>
                <th className="px-4 py-3 text-start font-medium">תחום</th>
                <th className="px-4 py-3 text-start font-medium">טלפון</th>
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
                : accounts.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => navigate(`/crm/accounts/${a.id}`)}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-raised/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={a.name} size="sm" />
                          <span className="font-medium text-ink">{a.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            a.kind === 'business'
                              ? 'bg-info-soft text-info'
                              : 'bg-surface-raised text-muted'
                          }
                        >
                          {KIND_LABEL[a.kind]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted">{a.industry || '—'}</td>
                      <td className="px-4 py-3 text-muted" dir="ltr">
                        <span className="block text-end">{a.phone || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-muted">{formatDate(a.created_at)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {!isLoading && accounts.length === 0 && (
          <EmptyState
            icon="🏢"
            title={q ? 'לא נמצאו חשבונות' : 'עדיין אין חשבונות'}
            hint={q ? 'נסו מונח חיפוש אחר.' : 'צרו חשבון ראשון כדי לרכז לקוחות ועסקאות.'}
            action={
              !q ? (
                <Button onClick={() => setModalOpen(true)} type="button">
                  יצירת חשבון
                </Button>
              ) : undefined
            }
          />
        )}
      </div>

      <NewAccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={(b) => create.mutate(b)}
        saving={create.isPending}
      />
    </div>
  );
}
