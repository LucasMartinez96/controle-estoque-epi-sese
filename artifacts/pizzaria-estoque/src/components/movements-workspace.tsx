import { useMemo, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'wouter';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Check,
  CircleAlert,
  ClipboardList,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import {
  getGetCatalogSummaryQueryKey,
  getListMovementsQueryKey,
  getListProductsQueryKey,
  MovementType,
  type Movement,
  type Product,
  useCreateMovement,
  useListMovements,
  useListProducts,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

type Notice = { tone: 'success' | 'error'; text: string } | null;
type Kind = 'ENTRY' | 'EXIT' | 'ADJUSTMENT';

const kindTabs: { kind: Kind; label: string; icon: typeof ArrowDownToLine }[] = [
  { kind: 'ENTRY', label: 'Entrada', icon: ArrowDownToLine },
  { kind: 'EXIT', label: 'Saída', icon: ArrowUpFromLine },
  { kind: 'ADJUSTMENT', label: 'Ajuste', icon: Settings2 },
];

const entryExitSchema = z.object({
  productId: z.coerce.number().min(1, 'Escolha um EPI.'),
  quantity: z.coerce.number().gt(0, 'Informe uma quantidade maior que zero.'),
  unitCost: z.coerce.number().min(0).optional(),
  lotCode: z.string().max(80).optional(),
  expirationDate: z.string().optional(),
  recipientName: z.string().max(160).optional(),
  recipientRegistration: z.string().max(60).optional(),
  reason: z.string().max(160).optional(),
  notes: z.string().optional(),
});
const adjustmentSchema = z.object({
  productId: z.coerce.number().min(1, 'Escolha um EPI.'),
  newStock: z.coerce.number().min(0, 'Use zero ou um valor maior.'),
  reason: z.string().max(160).optional(),
  notes: z.string().optional(),
});
type EntryExitValues = z.infer<typeof entryExitSchema>;
type AdjustmentValues = z.infer<typeof adjustmentSchema>;

function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft' | 'danger' }) {
  const variants = {
    primary: 'bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:shadow-md',
    ghost: 'bg-transparent text-foreground hover:bg-muted',
    soft: 'bg-secondary text-secondary-foreground hover:bg-secondary/75',
    danger: 'bg-destructive/10 text-destructive hover:bg-destructive/15',
  };
  return (
    <button
      type={props.type ?? 'button'}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="block text-xs font-medium text-destructive">{error}</span> : null}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'h-11 w-full rounded-xl border border-input bg-background/80 px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

function number(value: number, unit: string) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

function datetime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function kindLabel(type: MovementType) {
  if (type === 'ENTRY') return 'Entrada';
  if (type === 'EXIT') return 'Saída';
  return 'Ajuste';
}

function kindTone(type: MovementType) {
  if (type === 'ENTRY') return 'bg-accent/10 text-accent';
  if (type === 'EXIT') return 'bg-primary/10 text-primary';
  return 'bg-secondary text-secondary-foreground';
}

function EntryExitForm({
  kind,
  products,
  onDone,
  notify,
}: {
  kind: 'ENTRY' | 'EXIT';
  products: Product[];
  onDone: () => void;
  notify: (notice: Notice) => void;
}) {
  const queryClient = useQueryClient();
  const create = useCreateMovement();
  const form = useForm<EntryExitValues>({
    resolver: zodResolver(entryExitSchema),
    defaultValues: { productId: 0, quantity: 0, unitCost: undefined, lotCode: '', expirationDate: '', recipientName: '', recipientRegistration: '', reason: '', notes: '' },
  });
  const selected = products.find((product) => product.id === Number(form.watch('productId')));

  const onSubmit = form.handleSubmit((values) => {
    if (kind === 'ENTRY' && (!values.lotCode?.trim() || !values.expirationDate)) {
      notify({ tone: 'error', text: 'Informe o lote e a validade do EPI para registrar a entrada.' });
      return;
    }
    if (kind === 'EXIT' && !values.recipientName?.trim()) {
      notify({ tone: 'error', text: 'Informe o colaborador que recebeu o EPI.' });
      return;
    }
    if (kind === 'EXIT' && !values.recipientRegistration?.trim()) {
      notify({ tone: 'error', text: 'Informe a matrícula do colaborador.' });
      return;
    }
    create.mutate(
      {
        data: {
          productId: values.productId,
          type: kind,
          quantity: values.quantity,
          unitCost: values.unitCost,
          lotCode: kind === 'ENTRY' ? values.lotCode || undefined : undefined,
          expirationDate: kind === 'ENTRY' ? values.expirationDate || undefined : undefined,
          recipientName: kind === 'EXIT' ? values.recipientName?.trim() || undefined : undefined,
          recipientRegistration: kind === 'EXIT' ? values.recipientRegistration?.trim() || undefined : undefined,
          reason: values.reason || undefined,
          notes: values.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMovementsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
          notify({ tone: 'success', text: kind === 'ENTRY' ? 'Entrada registrada.' : 'Saída registrada.' });
          form.reset({ productId: 0, quantity: 0, unitCost: undefined, lotCode: '', expirationDate: '', recipientName: '', recipientRegistration: '', reason: '', notes: '' });
          onDone();
        },
        onError: (error) => notify({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível registrar a movimentação.' }),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="EPI" error={form.formState.errors.productId?.message}>
        <select {...form.register('productId')} className={inputClass} data-testid="select-movement-product">
          <option value={0}>Selecione um EPI de segurança</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({number(product.currentStock, product.unit)} em estoque)</option>)}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Quantidade${selected ? ` (${selected.unit})` : ''}`} error={form.formState.errors.quantity?.message}>
          <input type="number" step="0.001" min="0" {...form.register('quantity')} className={inputClass} data-testid="input-movement-quantity" />
        </Field>
        {kind === 'ENTRY' ? (
          <Field label="Custo unitário (opcional)" error={form.formState.errors.unitCost?.message}>
            <input type="number" step="0.01" min="0" {...form.register('unitCost')} className={inputClass} data-testid="input-movement-unit-cost" />
          </Field>
        ) : null}
      </div>
      {kind === 'ENTRY' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lote" hint="Obrigatório na entrada">
            <input {...form.register('lotCode', { required: kind === 'ENTRY' })} className={inputClass} placeholder="Ex.: LT-2026-0911" data-testid="input-movement-lot" />
          </Field>
          <Field label="Validade" hint="Obrigatória na entrada">
            <input type="date" {...form.register('expirationDate', { required: kind === 'ENTRY' })} className={inputClass} data-testid="input-movement-expiration" />
          </Field>
        </div>
      ) : null}
      {kind === 'EXIT' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Colaborador" error={form.formState.errors.recipientName?.message} hint="Obrigatório na saída">
            <input {...form.register('recipientName')} className={inputClass} placeholder="Ex.: João da Silva" data-testid="input-exit-recipient-name" />
          </Field>
          <Field label="Matrícula" error={form.formState.errors.recipientRegistration?.message} hint="Obrigatória na saída">
            <input {...form.register('recipientRegistration')} className={inputClass} placeholder="Ex.: 123456" data-testid="input-exit-recipient-registration" />
          </Field>
        </div>
      ) : null}
      <Field label="Motivo (opcional)" error={form.formState.errors.reason?.message}>
        <input {...form.register('reason')} className={inputClass} placeholder={kind === 'ENTRY' ? 'Ex.: recebimento do fornecedor' : 'Ex.: entrega ao colaborador, perda, avaria'} data-testid="input-movement-reason" />
      </Field>
      <Field label="Observações (opcional)">
        <textarea {...form.register('notes')} className={`${inputClass} h-24 resize-none py-2.5`} data-testid="input-movement-notes" />
      </Field>
      {kind === 'EXIT' && selected && Number(form.watch('quantity')) > selected.currentStock ? (
        <p className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-xs font-semibold text-destructive"><CircleAlert size={14} /> Essa saída deixará o estoque negativo — o servidor pode recusar, a menos que estoque negativo esteja liberado.</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={create.isPending} data-testid="button-submit-movement">
        {create.isPending ? 'Salvando...' : kind === 'ENTRY' ? 'Registrar entrada' : 'Registrar saída'}
      </Button>
    </form>
  );
}

function AdjustmentForm({ products, onDone, notify }: { products: Product[]; onDone: () => void; notify: (notice: Notice) => void }) {
  const queryClient = useQueryClient();
  const create = useCreateMovement();
  const form = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { productId: 0, newStock: 0, reason: '', notes: '' },
  });
  const selected = products.find((product) => product.id === Number(form.watch('productId')));
  const newStock = Number(form.watch('newStock'));
  const diff = selected ? newStock - selected.currentStock : 0;

  const onSubmit = form.handleSubmit((values) => {
    create.mutate(
      {
        data: {
          productId: values.productId,
          type: 'ADJUSTMENT',
          newStock: values.newStock,
          reason: values.reason || undefined,
          notes: values.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMovementsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
          notify({ tone: 'success', text: 'Ajuste registrado.' });
          form.reset({ productId: 0, newStock: 0, reason: '', notes: '' });
          onDone();
        },
        onError: (error) => notify({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível registrar o ajuste.' }),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="EPI" error={form.formState.errors.productId?.message}>
        <select {...form.register('productId')} className={inputClass} data-testid="select-adjustment-product">
          <option value={0}>Selecione um EPI de segurança</option>
          {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({number(product.currentStock, product.unit)} em estoque)</option>)}
        </select>
      </Field>
      <Field label={`Nova contagem física${selected ? ` (${selected.unit})` : ''}`} error={form.formState.errors.newStock?.message} hint={selected ? `Estoque atual no sistema: ${number(selected.currentStock, selected.unit)}` : undefined}>
        <input type="number" step="0.001" min="0" {...form.register('newStock')} className={inputClass} data-testid="input-adjustment-new-stock" />
      </Field>
      {selected && diff !== 0 ? (
        <p className={`rounded-xl px-3 py-2.5 text-xs font-semibold ${diff > 0 ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}>
          {diff > 0 ? `Isso vai somar ${number(diff, selected.unit)} ao estoque.` : `Isso vai subtrair ${number(Math.abs(diff), selected.unit)} do estoque.`}
        </p>
      ) : null}
      <Field label="Motivo (opcional)" error={form.formState.errors.reason?.message}>
        <input {...form.register('reason')} className={inputClass} placeholder="Ex.: contagem de inventário mensal" data-testid="input-adjustment-reason" />
      </Field>
      <Field label="Observações (opcional)">
        <textarea {...form.register('notes')} className={`${inputClass} h-24 resize-none py-2.5`} data-testid="input-adjustment-notes" />
      </Field>
      <Button type="submit" className="w-full" disabled={create.isPending} data-testid="button-submit-adjustment">
        {create.isPending ? 'Salvando...' : 'Registrar ajuste'}
      </Button>
    </form>
  );
}

function MovementsTable({ movements, loading, error }: { movements: Movement[]; loading: boolean; error: boolean }) {
  if (loading) return <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>;
  if (error) return <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><CircleAlert className="text-destructive" /><p className="text-sm font-semibold">Não foi possível carregar o histórico.</p></div>;
  if (!movements.length) return <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><ClipboardList className="text-muted-foreground" /><p className="text-sm font-semibold">Nenhuma movimentação registrada ainda.</p></div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left">
        <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <tr><th className="px-5 py-3 font-bold">EPI</th><th className="px-3 py-3 font-bold">Tipo</th><th className="px-3 py-3 font-bold">Quantidade</th><th className="px-3 py-3 font-bold">Saldo</th><th className="px-3 py-3 font-bold">Quando</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {movements.map((movement) => (
            <tr key={movement.id} className="hover:bg-muted/30" data-testid={`row-movement-${movement.id}`}>
              <td className="px-5 py-4"><p className="font-semibold">{movement.productName}</p>{movement.lotCode ? <p className="text-xs font-medium text-muted-foreground">Lote {movement.lotCode}{movement.expirationDate ? ` · Val. ${new Intl.DateTimeFormat('pt-BR').format(new Date(`${movement.expirationDate}T12:00:00`))}` : ''}</p> : null}{movement.type === 'EXIT' && movement.recipientName ? <p className="text-xs font-medium text-muted-foreground">Entregue a {movement.recipientName}{movement.recipientRegistration ? ` · Matrícula ${movement.recipientRegistration}` : ''}</p> : null}{movement.reason ? <p className="text-xs text-muted-foreground">{movement.reason}</p> : null}</td>
              <td className="px-3 py-4"><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${kindTone(movement.type)}`}>{kindLabel(movement.type)}</span></td>
              <td className="px-3 py-4 text-sm font-semibold">{number(movement.quantity, movement.unit)}</td>
              <td className="px-3 py-4 text-sm text-muted-foreground">{number(movement.stockBefore, movement.unit)} → <span className="font-semibold text-foreground">{number(movement.stockAfter, movement.unit)}</span></td>
              <td className="px-3 py-4 text-xs text-muted-foreground">{datetime(movement.occurredAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovementsWorkspace() {
  const [kind, setKind] = useState<Kind>('ENTRY');
  const [notice, setNotice] = useState<Notice>(null);
  const productsQuery = useListProducts({ activeOnly: true });
  const movementsQuery = useListMovements({ limit: 50 });
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const movements = movementsQuery.data ?? [];

  const notify = (value: Notice) => {
    setNotice(value);
    window.setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="paper-noise min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground" data-testid="link-back-to-catalog" aria-label="Voltar ao catálogo"><ArrowLeft size={18} /></Link>
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><ShieldCheck size={20} /></div><div><p className="font-serif text-lg font-bold leading-none">SESÉ</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Movimentações de EPI</p></div></div>
          </div>
        </div>
      </header>

      <main className="px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
        <div className="mx-auto max-w-[1200px]">
          <div className="animate-rise mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Gestão de EPIs</p><h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">Entradas, saídas e ajustes</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Toda movimentação atualiza o estoque na hora e fica registrada no histórico abaixo.</p></div>

          {notice ? <div className={`animate-rise mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'success' ? 'border-accent/20 bg-accent/10 text-accent' : 'border-destructive/20 bg-destructive/10 text-destructive'}`} data-testid="status-notice"><Check size={16} /> {notice.text}</div> : null}

          <div className="grid gap-5 lg:grid-cols-[.9fr_1.3fr]">
            <section className="animate-rise rounded-2xl border border-border bg-card p-5 shadow-[0_15px_40px_-30px_hsl(var(--foreground)/.4)]">
              <div className="mb-5 flex gap-2 rounded-xl bg-muted/60 p-1">
                {kindTabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = kind === tab.kind;
                  return (
                    <button key={tab.kind} type="button" onClick={() => setKind(tab.kind)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`tab-movement-${tab.kind.toLowerCase()}`}>
                      <Icon size={14} /> {tab.label}
                    </button>
                  );
                })}
              </div>

              {productsQuery.isLoading ? (
                <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="h-11 animate-pulse rounded-xl bg-muted" />)}</div>
              ) : products.length === 0 ? (
                <p className="rounded-xl bg-muted/50 p-5 text-sm text-muted-foreground">Cadastre ao menos um EPI ativo antes de registrar movimentações.</p>
              ) : kind === 'ADJUSTMENT' ? (
                <AdjustmentForm products={products} onDone={() => {}} notify={notify} />
              ) : (
                <EntryExitForm kind={kind} products={products} onDone={() => {}} notify={notify} />
              )}
            </section>

            <section className="animate-rise animate-rise-delay-1 rounded-2xl border border-border bg-card shadow-[0_15px_40px_-30px_hsl(var(--foreground)/.4)]">
              <div className="border-b border-border p-5"><h2 className="font-serif text-xl font-bold">Histórico recente</h2><p className="mt-1 text-xs text-muted-foreground">Últimas 50 movimentações, mais recentes primeiro.</p></div>
              <MovementsTable movements={movements} loading={movementsQuery.isLoading} error={movementsQuery.isError} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export function MovementsApp() {
  return <MovementsWorkspace />;
}
