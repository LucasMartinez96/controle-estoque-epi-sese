import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, CalendarDays, ClipboardList, PackageCheck, Search, ShieldCheck, UserRoundSearch } from 'lucide-react';
import { MovementType, type Movement, useListMovements } from '@workspace/api-client-react';

function number(value: number, unit: string) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}
function datetime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
type RecipientGroup = { key: string; name: string; registration: string; movements: Movement[]; totalDeliveries: number; totalPieces: number; lastDelivery?: string };

export function groupByRecipient(movements: Movement[]): RecipientGroup[] {
  const groups = new Map<string, RecipientGroup>();
  for (const movement of movements) {
    if (movement.type !== MovementType.EXIT || !movement.recipientName || !movement.recipientRegistration) continue;
    const registration = movement.recipientRegistration.trim();
    const name = movement.recipientName.trim();
    const key = registration.toLocaleLowerCase('pt-BR');
    const current = groups.get(key) ?? { key, name, registration, movements: [], totalDeliveries: 0, totalPieces: 0, lastDelivery: undefined };
    current.movements.push(movement);
    current.totalDeliveries += 1;
    current.totalPieces += movement.quantity;
    if (!current.lastDelivery || new Date(movement.occurredAt).getTime() > new Date(current.lastDelivery).getTime()) current.lastDelivery = movement.occurredAt;
    groups.set(key, current);
  }
  return Array.from(groups.values()).sort((a, b) => new Date(b.lastDelivery ?? 0).getTime() - new Date(a.lastDelivery ?? 0).getTime());
}

export function CollaboratorHistoryApp() {
  const [search, setSearch] = useState('');
  const recipientSearch = search.trim();
  const movementsQuery = useListMovements({ type: MovementType.EXIT, recipientSearch: recipientSearch || undefined, limit: 200 });
  const movements = useMemo(() => movementsQuery.data ?? [], [movementsQuery.data]);
  const groups = useMemo(() => groupByRecipient(movements), [movements]);
  const totalPieces = groups.reduce((sum, group) => sum + group.totalPieces, 0);

  return <div className="paper-noise min-h-[100dvh] bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl"><div className="flex h-[72px] items-center gap-3 px-4 sm:px-7 lg:px-10"><Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Voltar"><ArrowLeft size={18}/></Link><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck size={20}/></div><div><p className="font-serif text-lg font-bold leading-none">SESÉ</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Histórico por Colaborador</p></div></div></header>
    <main className="px-4 py-7 sm:px-7 sm:py-9 lg:px-10"><div className="mx-auto max-w-[1200px] space-y-5">
      <section><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">Rastreabilidade de EPIs</p><h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">Histórico por Colaborador</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Pesquise pelo nome ou matrícula e consulte todos os EPIs entregues, quantidades e datas.</p></section>
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><label className="relative block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18}/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Buscar colaborador ou matrícula..." className="h-12 w-full rounded-xl border border-input bg-background/80 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" data-testid="input-recipient-search"/></label></section>
      <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-muted-foreground"><UserRoundSearch size={16}/><span className="text-xs font-bold uppercase tracking-[0.12em]">Colaboradores</span></div><p className="mt-2 text-2xl font-bold">{groups.length}</p></div><div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-muted-foreground"><PackageCheck size={16}/><span className="text-xs font-bold uppercase tracking-[0.12em]">Entregas</span></div><p className="mt-2 text-2xl font-bold">{movements.length}</p></div><div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-muted-foreground"><ClipboardList size={16}/><span className="text-xs font-bold uppercase tracking-[0.12em]">Quantidade entregue</span></div><p className="mt-2 text-2xl font-bold">{new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(totalPieces)}</p></div></section>
      {movementsQuery.isLoading ? <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-28 animate-pulse rounded-2xl bg-muted"/>)}</div> : movementsQuery.isError ? <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-sm font-semibold text-destructive">Não foi possível carregar o histórico dos colaboradores.</div> : groups.length===0 ? <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center"><UserRoundSearch className="mx-auto text-muted-foreground"/><p className="mt-3 font-semibold">{recipientSearch?'Nenhum colaborador encontrado.':'Nenhuma saída de EPI para colaborador registrada ainda.'}</p></div> : <div className="space-y-4">{groups.map(group=><article key={group.key} className="overflow-hidden rounded-2xl border border-border bg-card" data-testid={`recipient-history-${group.registration}`}><div className="flex flex-col gap-3 border-b border-border bg-muted/35 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold">{group.name}</h2><p className="text-sm text-muted-foreground">Matrícula {group.registration}</p></div><div className="flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">{group.totalDeliveries} entrega{group.totalDeliveries===1?'':'s'}</span><span className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">{new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(group.totalPieces)} itens</span></div></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-5 py-3">EPI</th><th className="px-3 py-3">Quantidade</th><th className="px-3 py-3">Motivo</th><th className="px-3 py-3">Data</th></tr></thead><tbody className="divide-y divide-border">{group.movements.map(m=><tr key={m.id} className="hover:bg-muted/30"><td className="px-5 py-4 font-semibold">{m.productName}</td><td className="px-3 py-4">{number(m.quantity,m.unit)}</td><td className="px-3 py-4 text-sm text-muted-foreground">{m.reason||'Entrega de EPI'}</td><td className="px-3 py-4 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14}/>{datetime(m.occurredAt)}</span></td></tr>)}</tbody></table></div></article>)}</div>}
      <p className="text-center text-xs text-muted-foreground">Exibindo até 200 entregas mais recentes{recipientSearch?' para a busca atual':''}.</p>
    </div></main>
  </div>;
}
