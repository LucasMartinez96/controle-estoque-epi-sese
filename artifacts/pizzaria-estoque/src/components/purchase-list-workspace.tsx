import { useMemo, useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Printer,
  ShoppingCart,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import {
  getListPurchaseListQueryKey,
  useListPurchaseList,
  useMarkPurchaseItemPending,
  useMarkPurchaseItemPurchased,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

type Notice = { tone: 'success' | 'error'; text: string } | null;

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

function number(value: number, unit?: string) {
  const formatted = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const inputClass =
  'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

function PurchaseListWorkspace() {
  const [notice, setNotice] = useState<Notice>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const listQuery = useListPurchaseList();
  const markPurchased = useMarkPurchaseItemPurchased();
  const markPending = useMarkPurchaseItemPending();

  const items = listQuery.data ?? [];

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.categoryName))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items],
  );
  const suppliers = useMemo(
    () => Array.from(new Set(items.map((item) => item.supplierName).filter((name): name is string => Boolean(name)))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [items],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== 'all' && item.categoryName !== categoryFilter) return false;
      if (supplierFilter === 'none' && item.supplierName) return false;
      if (supplierFilter !== 'all' && supplierFilter !== 'none' && item.supplierName !== supplierFilter) return false;
      if (term && !item.productName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [items, categoryFilter, supplierFilter, search]);

  const summary = useMemo(
    () => ({
      productCount: filtered.length,
      totalQuantity: filtered.reduce((sum, item) => sum + item.suggestedQuantity, 0),
      totalEstimatedCost: filtered.reduce((sum, item) => sum + item.estimatedCost, 0),
    }),
    [filtered],
  );

  const notify = (value: Notice) => {
    setNotice(value);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListPurchaseListQueryKey() });

  const handleMarkPurchased = (productId: number) => {
    markPurchased.mutate(
      { productId },
      {
        onSuccess: () => {
          invalidate();
          notify({ tone: 'success', text: 'Item marcado como comprado.' });
        },
        onError: (error) => notify({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível marcar como comprado.' }),
      },
    );
  };

  const handleMarkPending = (productId: number) => {
    markPending.mutate(
      { productId },
      {
        onSuccess: () => {
          invalidate();
          notify({ tone: 'success', text: 'Item voltou para pendente.' });
        },
        onError: (error) => notify({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível reverter o item.' }),
      },
    );
  };

  const busyProductId = markPurchased.isPending
    ? markPurchased.variables?.productId
    : markPending.isPending
      ? markPending.variables?.productId
      : null;

  return (
    <div className="paper-noise min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl print:hidden">
        <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground" data-testid="link-back-to-catalog" aria-label="Voltar ao catálogo"><ArrowLeft size={18} /></Link>
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><ShieldCheck size={20} /></div><div><p className="font-serif text-lg font-bold leading-none">SESÉ</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Reposição de EPIs de Segurança</p></div></div>
          </div>
          <Button variant="soft" onClick={() => window.print()} data-testid="button-print-purchase-list"><Printer size={16} /> Imprimir reposição de EPIs</Button>
        </div>
      </header>

      <main className="px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
        <div className="mx-auto max-w-[1200px]">
          <div className="animate-rise mb-8 print:hidden"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Gestão de EPIs</p><h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">Reposição de EPIs de Segurança</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Calculada a partir do estoque real: EPIs no mínimo ou abaixo entram automaticamente para reposição até o nível máximo.</p></div>

          {notice ? <div className={`animate-rise mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold print:hidden ${notice.tone === 'success' ? 'border-accent/20 bg-accent/10 text-accent' : 'border-destructive/20 bg-destructive/10 text-destructive'}`} data-testid="status-notice"><Check size={16} /> {notice.text}</div> : null}

          <div className="mb-6 grid gap-4 sm:grid-cols-3 print:hidden">
            <div className="rounded-2xl border border-border bg-card p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">EPIs para repor</p><p className="mt-2 font-serif text-3xl font-bold" data-testid="text-summary-product-count">{summary.productCount}</p></div>
            <div className="rounded-2xl border border-border bg-card p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Quantidade total sugerida</p><p className="mt-2 font-serif text-3xl font-bold" data-testid="text-summary-total-quantity">{number(summary.totalQuantity)}</p><p className="mt-1 text-xs text-muted-foreground">Soma das quantidades sugeridas (as unidades de medida podem variar entre EPIs)</p></div>
            <div className="rounded-2xl border border-border bg-card p-5"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Valor estimado da compra</p><p className="mt-2 font-serif text-3xl font-bold text-primary" data-testid="text-summary-estimated-cost">{money(summary.totalEstimatedCost)}</p></div>
          </div>

          <section className="animate-rise animate-rise-delay-1 rounded-2xl border border-border bg-card shadow-[0_15px_40px_-30px_hsl(var(--foreground)/.4)] print:hidden">
            <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-3 sm:p-5">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Categoria de EPI</label>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass} data-testid="select-filter-category">
                  <option value="all">Todas</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Fornecedor de EPI</label>
                <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className={inputClass} data-testid="select-filter-supplier">
                  <option value="all">Todos</option>
                  <option value="none">Sem fornecedor de EPI</option>
                  {suppliers.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">EPI</label>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar EPI..." className={inputClass} data-testid="input-filter-product" />
              </div>
            </div>

            {listQuery.isLoading ? (
              <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : listQuery.isError ? (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><CircleAlert className="text-destructive" /><p className="text-sm font-semibold">Não foi possível carregar a reposição de EPIs.</p></div>
            ) : !filtered.length ? (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <ShoppingCart className="text-muted-foreground" />
                <p className="text-sm font-semibold">{items.length ? 'Nenhum item corresponde aos filtros.' : 'Nenhum EPI precisa de reposição — estoque em dia.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-bold">EPI</th>
                      <th className="px-3 py-3 font-bold">Categoria de EPI</th>
                      <th className="px-3 py-3 font-bold">Fornecedor de EPI</th>
                      <th className="px-3 py-3 font-bold">Unidade</th>
                      <th className="px-3 py-3 font-bold">Atual</th>
                      <th className="px-3 py-3 font-bold">Mínimo</th>
                      <th className="px-3 py-3 font-bold">Máximo</th>
                      <th className="px-3 py-3 font-bold">Qtd. sugerida</th>
                      <th className="px-5 py-3 text-right font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((item) => (
                      <tr key={item.productId} className={`hover:bg-muted/30 ${item.status === 'PURCHASED' ? 'opacity-60' : ''}`} data-testid={`row-purchase-item-${item.productId}`}>
                        <td className="px-5 py-4 font-semibold">{item.productName}</td>
                        <td className="px-3 py-4 text-sm text-muted-foreground">{item.categoryName}</td>
                        <td className="px-3 py-4 text-sm text-muted-foreground">{item.supplierName ?? '—'}</td>
                        <td className="px-3 py-4 text-sm text-muted-foreground">{item.unit}</td>
                        <td className="px-3 py-4 text-sm font-bold text-primary">{number(item.currentStock)}</td>
                        <td className="px-3 py-4 text-sm text-muted-foreground">{number(item.minimumStock)}</td>
                        <td className="px-3 py-4 text-sm text-muted-foreground">{number(item.maximumStock)}</td>
                        <td className="px-3 py-4 text-sm font-bold">{number(item.suggestedQuantity, item.unit)}</td>
                        <td className="px-5 py-4 text-right">
                          {item.status === 'PURCHASED' ? (
                            <Button
                              variant="ghost"
                              className="h-9 min-h-9 px-3 text-xs"
                              disabled={busyProductId === item.productId}
                              onClick={() => handleMarkPending(item.productId)}
                              data-testid={`button-mark-pending-${item.productId}`}
                            >
                              <Undo2 size={14} /> {busyProductId === item.productId ? 'Revertendo…' : 'Comprado'}
                            </Button>
                          ) : (
                            <Button
                              variant="soft"
                              className="h-9 min-h-9 px-3 text-xs"
                              disabled={busyProductId === item.productId}
                              onClick={() => handleMarkPurchased(item.productId)}
                              data-testid={`button-mark-purchased-${item.productId}`}
                            >
                              {busyProductId === item.productId ? 'Marcando…' : 'Marcar como comprado'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Versão de impressão: só o essencial para fazer a compra. */}
          <div className="hidden print:block">
            <h1 className="mb-1 text-xl font-bold">Reposição de EPIs de Segurança</h1>
            <p className="mb-4 text-xs text-muted-foreground">Gerada em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}</p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/40">
                  <th className="py-2 pr-3 font-bold">EPI</th>
                  <th className="py-2 pr-3 font-bold">Categoria de EPI</th>
                  <th className="py-2 pr-3 font-bold">Fornecedor de EPI</th>
                  <th className="py-2 pr-3 text-right font-bold">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.productId} className="border-b border-black/10">
                    <td className="py-2 pr-3">{item.productName}</td>
                    <td className="py-2 pr-3">{item.categoryName}</td>
                    <td className="py-2 pr-3">{item.supplierName ?? '—'}</td>
                    <td className="py-2 pr-3 text-right">{number(item.suggestedQuantity, item.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export function PurchaseListApp() {
  return <PurchaseListWorkspace />;
}
