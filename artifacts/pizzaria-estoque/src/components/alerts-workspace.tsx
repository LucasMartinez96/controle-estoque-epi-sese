import { useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  CircleAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  getGetCatalogSummaryQueryKey,
  getListAlertsQueryKey,
  getListProductsQueryKey,
  type StockAlert,
  useListAlerts,
  useResolveAlert,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

type Notice = { tone: 'success' | 'error'; text: string } | null;
type Tab = 'OPEN' | 'RESOLVED';

const tabs: { tab: Tab; label: string; icon: typeof BellRing }[] = [
  { tab: 'OPEN', label: 'Abertos', icon: BellRing },
  { tab: 'RESOLVED', label: 'Resolvidos', icon: CheckCircle2 },
];

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

function number(value: number, unit: string) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

function datetime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function AlertsTable({
  alerts,
  loading,
  error,
  tab,
  onResolve,
  resolvingId,
}: {
  alerts: StockAlert[];
  loading: boolean;
  error: boolean;
  tab: Tab;
  onResolve: (id: number) => void;
  resolvingId: number | null;
}) {
  if (loading) {
    return <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>;
  }
  if (error) {
    return <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><CircleAlert className="text-destructive" /><p className="text-sm font-semibold">Não foi possível carregar os alertas.</p></div>;
  }
  if (!alerts.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <Bell className="text-muted-foreground" />
        <p className="text-sm font-semibold">
          {tab === 'OPEN' ? 'Nenhum alerta aberto no momento.' : 'Nenhum alerta resolvido ainda.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="px-5 py-3 font-bold">EPI</th>
            <th className="px-3 py-3 font-bold">Estoque no disparo</th>
            <th className="px-3 py-3 font-bold">Mínimo no disparo</th>
            <th className="px-3 py-3 font-bold">Disparado em</th>
            <th className="px-5 py-3 text-right font-bold">{tab === 'OPEN' ? 'Ação' : 'Resolvido em'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {alerts.map((alert) => (
            <tr key={alert.id} className="hover:bg-muted/30" data-testid={`row-alert-${alert.id}`}>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-bold">
                    <BellRing size={16} />
                  </div>
                  <p className="font-semibold">{alert.productName}</p>
                </div>
              </td>
              <td className="px-3 py-4 text-sm font-bold text-primary">{number(alert.stockAtTrigger, alert.unit)}</td>
              <td className="px-3 py-4 text-sm text-muted-foreground">{number(alert.minimumStockAtTrigger, alert.unit)}</td>
              <td className="px-3 py-4 text-xs text-muted-foreground">{datetime(alert.triggeredAt)}</td>
              <td className="px-5 py-4 text-right">
                {tab === 'OPEN' ? (
                  <Button
                    variant="soft"
                    className="h-9 min-h-9 px-3 text-xs"
                    disabled={resolvingId === alert.id}
                    onClick={() => onResolve(alert.id)}
                    data-testid={`button-resolve-alert-${alert.id}`}
                  >
                    {resolvingId === alert.id ? 'Resolvendo…' : 'Marcar como resolvido'}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{datetime(alert.resolvedAt)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertsWorkspace() {
  const [tab, setTab] = useState<Tab>('OPEN');
  const [notice, setNotice] = useState<Notice>(null);
  const queryClient = useQueryClient();
  const alertsQuery = useListAlerts({ status: tab, limit: 100 });
  const resolve = useResolveAlert();
  const alerts = alertsQuery.data ?? [];
  const resolvingId = resolve.isPending ? (resolve.variables?.id ?? null) : null;

  const notify = (value: Notice) => {
    setNotice(value);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const handleResolve = (id: number) => {
    resolve.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
          notify({ tone: 'success', text: 'Alerta marcado como resolvido.' });
        },
        onError: (error) => notify({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível resolver o alerta.' }),
      },
    );
  };

  return (
    <div className="paper-noise min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground" data-testid="link-back-to-catalog" aria-label="Voltar ao catálogo"><ArrowLeft size={18} /></Link>
            <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><ShieldCheck size={20} /></div><div><p className="font-serif text-lg font-bold leading-none">SESÉ</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Alertas</p></div></div>
          </div>
        </div>
      </header>

      <main className="px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
        <div className="mx-auto max-w-[1200px]">
          <div className="animate-rise mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Gestão de EPIs</p><h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">Alertas de EPI</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Aberto quando o estoque atual fica igual ou abaixo do mínimo, resolvido automaticamente quando volta a ficar acima.</p></div>

          {notice ? <div className={`animate-rise mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'success' ? 'border-accent/20 bg-accent/10 text-accent' : 'border-destructive/20 bg-destructive/10 text-destructive'}`} data-testid="status-notice"><Check size={16} /> {notice.text}</div> : null}

          <section className="animate-rise animate-rise-delay-1 rounded-2xl border border-border bg-card shadow-[0_15px_40px_-30px_hsl(var(--foreground)/.4)]">
            <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              <div><h2 className="font-serif text-xl font-bold">Alertas</h2><p className="mt-1 text-xs text-muted-foreground">Alertas de EPIs de segurança abaixo ou no limite mínimo, registrados no histórico do sistema.</p></div>
              <div className="flex gap-2 rounded-xl bg-muted/60 p-1">
                {tabs.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.tab;
                  return (
                    <button key={item.tab} type="button" onClick={() => setTab(item.tab)} className={`flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold transition ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} data-testid={`tab-alert-${item.tab.toLowerCase()}`}>
                      <Icon size={14} /> {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <AlertsTable
              alerts={alerts}
              loading={alertsQuery.isLoading}
              error={alertsQuery.isError}
              tab={tab}
              onResolve={handleResolve}
              resolvingId={resolvingId}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

export function AlertsApp() {
  return <AlertsWorkspace />;
}
