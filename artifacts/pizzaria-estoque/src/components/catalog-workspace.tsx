import { useMemo, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation } from 'wouter';
import {
  Archive,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  CirclePlus,
  ClipboardList,
  Database,
  Edit3,
  LayoutDashboard,
  Mail,
  Menu,
  Package,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  UserRoundSearch,
  X,
} from 'lucide-react';
import {
  getGetCatalogSummaryQueryKey,
  getListCategoriesQueryKey,
  getListProductsQueryKey,
  getListSuppliersQueryKey,
  ProductInputUnit,
  type Category,
  type CatalogSummary,
  type Product,
  type ProductInput,
  type ProductUpdate,
  type Supplier,
  useCreateCategory,
  useCreateProduct,
  useCreateSupplier,
  useGetCatalogSummary,
  useListCategories,
  useListProducts,
  useListSuppliers,
  useUpdateCategory,
  useUpdateProduct,
  useUpdateSupplier,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

type Notice = { tone: 'success' | 'error'; text: string } | null;
type Modal = 'product' | 'category' | 'supplier' | null;
type Focus = 'dashboard' | 'products' | 'categories' | 'suppliers';

const productSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do EPI.'),
  categoryId: z.coerce.number().min(1, 'Escolha uma categoria de EPI.'),
  supplierId: z.coerce.number().optional(),
  ca: z.string().trim().min(1, 'Informe o CA do EPI.').max(30),
  manufacturer: z.string().trim().min(1, 'Informe o fabricante.').max(120),
  size: z.string().trim().max(40).optional(),
  unit: z.enum(['UN', 'PAR', 'KG', 'G', 'L', 'ML', 'CX', 'PCT']),
  currentStock: z.coerce.number().min(0, 'Use zero ou um valor maior.').optional(),
  minimumStock: z.coerce.number().min(0, 'Use zero ou um valor maior.'),
  maximumStock: z.coerce.number().min(0, 'Use zero ou um valor maior.'),
  unitCost: z.coerce.number().min(0, 'Use zero ou um valor maior.'),
});
const categorySchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da categoria de EPI.').max(120, 'Máximo de 120 caracteres.'),
});
const supplierSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do fornecedor de EPI.').max(160, 'Máximo de 160 caracteres.'),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Informe um e-mail válido.').optional().or(z.literal('')),
  notes: z.string().optional(),
});
type ProductValues = z.infer<typeof productSchema>;
type CategoryValues = z.infer<typeof categorySchema>;
type SupplierValues = z.infer<typeof supplierSchema>;

const navItems: { label: string; href: string; icon: typeof LayoutDashboard; focus: Focus }[] = [
  { label: 'Visão geral', href: '/', icon: LayoutDashboard, focus: 'dashboard' },
  { label: 'EPIs', href: '/produtos', icon: Package, focus: 'products' },
  { label: 'Categorias de EPI', href: '/categorias', icon: Tags, focus: 'categories' },
  { label: 'Fornecedores de EPI', href: '/fornecedores', icon: Truck, focus: 'suppliers' },
];

// 'Movimentações' is intentionally not in navItems above: it lives on its
// own page (movements-workspace.tsx) and isn't one of the catalog `Focus`
// values. It's linked from the sidebar footer instead — see the shortcut
// button rendered next to <ShieldCheck /> below.

function money(value: number | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0);
}

function number(value: number, unit: string) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}

function date(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value));
}

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

function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
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

function ModalFrame({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="max-h-[94dvh] w-full overflow-auto rounded-t-[1.5rem] border border-border bg-card p-5 shadow-2xl sm:max-w-xl sm:rounded-[1.5rem] sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
            <h2 className="font-serif text-2xl font-bold tracking-tight">{title}</h2>
          </div>
          <Button variant="ghost" className="h-10 min-h-10 w-10 rounded-full p-0" onClick={onClose} data-testid="button-close-modal" aria-label="Fechar">
            <X size={18} />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${active ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-accent' : 'bg-muted-foreground/50'}`} />
      {active ? 'Ativo' : 'Desativado'}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Boxes;
  accent: string;
  loading?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[0_10px_30px_-24px_hsl(var(--foreground)/.35)] transition-transform duration-300 hover:-translate-y-1 sm:p-5">
      <div className={`absolute right-0 top-0 h-20 w-20 translate-x-5 -translate-y-5 rounded-full ${accent} opacity-25 blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          {loading ? <div className="mt-2 h-8 w-24 animate-pulse rounded-lg bg-muted" /> : <p className="mt-1 font-serif text-3xl font-bold tracking-tight">{value}</p>}
          <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${accent}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function ProductForm({
  product,
  categories,
  suppliers,
  onClose,
  onDone,
  notify,
}: {
  product?: Product;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onDone: () => void;
  notify: (notice: Notice) => void;
}) {
  const queryClient = useQueryClient();
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const form = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          categoryId: product.categoryId,
          supplierId: product.supplierId ?? undefined,
          ca: product.ca,
          manufacturer: product.manufacturer,
          size: product.size ?? '',
          unit: product.unit,
          minimumStock: product.minimumStock,
          maximumStock: product.maximumStock,
          unitCost: product.unitCost,
        }
      : { name: '', categoryId: 0, supplierId: undefined, ca: '', manufacturer: '', size: '', unit: 'UN', currentStock: 0, minimumStock: 0, maximumStock: 0, unitCost: 0 },
  });
  const submit = (values: ProductValues) => {
    const finish = () => {
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
      notify({ tone: 'success', text: product ? 'EPI atualizado.' : 'EPI adicionado ao estoque.' });
      onDone();
    };
    if (product) {
      // Estoque atual nunca é enviado na edição — só entrada, saída ou
      // ajuste podem alterar o saldo. Isso evita uma segunda lógica de
      // alteração de estoque fora das movimentações.
      const body: ProductUpdate = {
        name: values.name,
        categoryId: values.categoryId,
        supplierId: values.supplierId || null,
        ca: values.ca,
        manufacturer: values.manufacturer,
        size: values.size || null,
        unit: values.unit as ProductUpdate['unit'],
        minimumStock: values.minimumStock,
        maximumStock: values.maximumStock,
        unitCost: values.unitCost,
      };
      update.mutate({ id: product.id, data: body }, { onSuccess: finish, onError: () => notify({ tone: 'error', text: 'Não foi possível atualizar o EPI.' }) });
    } else {
      const body: ProductInput = {
        name: values.name,
        categoryId: values.categoryId,
        supplierId: values.supplierId || null,
        ca: values.ca,
        manufacturer: values.manufacturer,
        size: values.size || null,
        unit: values.unit as ProductInput['unit'],
        currentStock: 0,
        minimumStock: values.minimumStock,
        maximumStock: values.maximumStock,
        unitCost: values.unitCost,
      };
      create.mutate({ data: body }, { onSuccess: finish, onError: () => notify({ tone: 'error', text: 'Não foi possível cadastrar o EPI.' }) });
    }
  };
  const busy = create.isPending || update.isPending;
  return (
    <form onSubmit={form.handleSubmit(
  submit,
  (errors) => {
    console.log('ERROS CADASTRO EPI:', errors);
    const primeiro = Object.values(errors)[0];
    notify({
      tone: 'error',
      text: primeiro?.message?.toString() || 'Confira os campos obrigatórios do EPI.',
    });
  }
)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do EPI" error={form.formState.errors.name?.message}>
          <input {...form.register('name')} className={inputClass} placeholder="Ex.: Luva de Segurança" data-testid="input-product-name" />
        </Field>
        <Field label="Unidade" error={form.formState.errors.unit?.message}>
          <select {...form.register('unit')} className={inputClass} data-testid="select-product-unit">
            {Object.values(ProductInputUnit).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
        </Field>
        <Field label="Categoria de EPI" error={form.formState.errors.categoryId?.message}>
          <select {...form.register('categoryId')} className={inputClass} data-testid="select-product-category">
            <option value={0}>Escolha uma categoria de EPI</option>
            {categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </Field>
        <Field label="Fornecedor de EPI" hint="Opcional">
          <select {...form.register('supplierId')} className={inputClass} data-testid="select-product-supplier">
            <option value="">Sem fornecedor de EPI</option>
            {suppliers.filter((supplier) => supplier.isActive).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </Field>
        <Field label="CA" error={form.formState.errors.ca?.message} hint="Certificado de Aprovação">
          <input {...form.register('ca')} className={inputClass} placeholder="Ex.: 12345" data-testid="input-product-ca" />
        </Field>
        <Field label="Fabricante" error={form.formState.errors.manufacturer?.message}>
          <input {...form.register('manufacturer')} className={inputClass} placeholder="Ex.: 3M, Danny, Kalipso" data-testid="input-product-manufacturer" />
        </Field>
        <Field label="Tamanho" error={form.formState.errors.size?.message} hint="Opcional">
          <input {...form.register('size')} className={inputClass} placeholder="Ex.: P, M, G, 40, 42" data-testid="input-product-size" />
        </Field>
      </div>
      <div className="rounded-2xl bg-muted/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold"><ClipboardList size={16} className="text-primary" /> Níveis de estoque</div>
        <div className="grid gap-4 sm:grid-cols-3">
          {product ? (
            <Field label="Estoque atual" hint="Use Entrada, Saída ou Ajuste para alterar.">
              <input
                type="text"
                value={`${product.currentStock} ${product.unit}`}
                disabled
                readOnly
                className={`${inputClass} cursor-not-allowed bg-muted text-muted-foreground`}
                data-testid="input-current-stock-readonly"
              />
            </Field>
          ) : (
            <Field label="Estoque inicial" hint="Começa em zero. Use Entrada para cadastrar o primeiro lote.">
              <input value="0" disabled readOnly className={`${inputClass} cursor-not-allowed bg-muted text-muted-foreground`} />
            </Field>
          )}
          <Field label="Mínimo" error={form.formState.errors.minimumStock?.message}><input type="number" step="0.01" {...form.register('minimumStock')} className={inputClass} data-testid="input-minimum-stock" /></Field>
          <Field label="Máximo" error={form.formState.errors.maximumStock?.message}><input type="number" step="0.01" {...form.register('maximumStock')} className={inputClass} data-testid="input-maximum-stock" /></Field>
        </div>
      </div>
      <Field label="Custo unitário (R$)" error={form.formState.errors.unitCost?.message}>
        <div className="relative"><span className="absolute left-3 top-3 text-sm text-muted-foreground">R$</span><input type="number" step="0.01" {...form.register('unitCost')} className={`${inputClass} pl-10`} data-testid="input-unit-cost" /></div>
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} data-testid="button-cancel-product">Cancelar</Button>
        <Button type="submit" disabled={busy} data-testid="button-save-product">{busy ? 'Salvando…' : product ? 'Salvar alterações' : 'Adicionar EPI'}</Button>
      </div>
    </form>
  );
}

function CategoryForm({ category, onClose, onDone, notify }: { category?: Category; onClose: () => void; onDone: () => void; notify: (notice: Notice) => void }) {
  const queryClient = useQueryClient();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const form = useForm<CategoryValues>({ resolver: zodResolver(categorySchema), defaultValues: { name: category?.name ?? '' } });
  const submit = (values: CategoryValues) => {
    const finish = () => {
      queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
      notify({ tone: 'success', text: category ? 'Categoria de EPI atualizada.' : 'Categoria de EPI criada.' });
      onDone();
    };
    if (category) update.mutate({ id: category.id, data: values }, { onSuccess: finish, onError: () => notify({ tone: 'error', text: 'Não foi possível atualizar a categoria de EPI.' }) });
    else create.mutate({ data: values }, { onSuccess: finish, onError: () => notify({ tone: 'error', text: 'Não foi possível criar a categoria de EPI.' }) });
  };
  const busy = create.isPending || update.isPending;
  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
      <Field label="Nome da categoria de EPI" error={form.formState.errors.name?.message}><input {...form.register('name')} className={inputClass} placeholder="Ex.: Proteção das Mãos" data-testid="input-category-name" /></Field>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} data-testid="button-cancel-category">Cancelar</Button>
        <Button type="submit" disabled={busy} data-testid="button-save-category">{busy ? 'Salvando…' : category ? 'Salvar alterações' : 'Adicionar categoria de EPI'}</Button>
      </div>
    </form>
  );
}

function SupplierForm({ supplier, onClose, onDone, notify }: { supplier?: Supplier; onClose: () => void; onDone: () => void; notify: (notice: Notice) => void }) {
  const queryClient = useQueryClient();
  const create = useCreateSupplier();
  const update = useUpdateSupplier();
  const form = useForm<SupplierValues>({ resolver: zodResolver(supplierSchema), defaultValues: { name: supplier?.name ?? '', phone: supplier?.phone ?? '', whatsapp: supplier?.whatsapp ?? '', email: supplier?.email ?? '', notes: supplier?.notes ?? '' } });
  const submit = (values: SupplierValues) => {
    const body = { ...values, phone: values.phone || null, whatsapp: values.whatsapp || null, email: values.email || null, notes: values.notes || null };
    const finish = () => {
      queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
      notify({ tone: 'success', text: supplier ? 'Fornecedor de EPI atualizado.' : 'Fornecedor de EPI criado.' });
      onDone();
    };
    if (supplier) update.mutate({ id: supplier.id, data: body }, { onSuccess: finish, onError: () => notify({ tone: 'error', text: 'Não foi possível atualizar o fornecedor de EPI.' }) });
    else create.mutate({ data: body }, { onSuccess: finish, onError: () => notify({ tone: 'error', text: 'Não foi possível criar o fornecedor de EPI.' }) });
  };
  const busy = create.isPending || update.isPending;
  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
      <Field label="Nome do fornecedor de EPI" error={form.formState.errors.name?.message}><input {...form.register('name')} className={inputClass} placeholder="Ex.: 3M, Danny, Kalipso" data-testid="input-supplier-name" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Telefone"><input {...form.register('phone')} className={inputClass} placeholder="(11) 0000-0000" data-testid="input-supplier-phone" /></Field>
        <Field label="WhatsApp"><input {...form.register('whatsapp')} className={inputClass} placeholder="(11) 90000-0000" data-testid="input-supplier-whatsapp" /></Field>
        <Field label="E-mail" error={form.formState.errors.email?.message}><input type="email" {...form.register('email')} className={inputClass} placeholder="compras@fornecedorepi.com" data-testid="input-supplier-email" /></Field>
      </div>
      <Field label="Notas" hint="Condições de entrega, horários ou observações úteis."><textarea {...form.register('notes')} className={`${inputClass} h-24 resize-none py-3`} placeholder="Ex.: Entrega às terças e quintas." data-testid="input-supplier-notes" /></Field>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} data-testid="button-cancel-supplier">Cancelar</Button>
        <Button type="submit" disabled={busy} data-testid="button-save-supplier">{busy ? 'Salvando…' : supplier ? 'Salvar alterações' : 'Adicionar fornecedor de EPI'}</Button>
      </div>
    </form>
  );
}

function EmptyState({ icon: Icon, title, text, onAdd, action }: { icon: typeof Package; title: string; text: string; onAdd: () => void; action: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 rounded-2xl bg-secondary p-4 text-primary"><Icon size={28} /></div>
      <h3 className="font-serif text-xl font-bold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{text}</p>
      <Button className="mt-6" onClick={onAdd} data-testid="button-empty-add"><Plus size={16} /> {action}</Button>
    </div>
  );
}

function TableState({ loading, error, empty, children, onRetry, onAdd, icon, emptyTitle, emptyText, addLabel }: { loading?: boolean; error?: boolean; empty?: boolean; children: ReactNode; onRetry: () => void; onAdd: () => void; icon: typeof Package; emptyTitle: string; emptyText: string; addLabel: string }) {
  if (loading) return <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>;
  if (error) return <div className="flex flex-col items-center gap-3 px-6 py-14 text-center"><CircleAlert className="text-destructive" /><p className="text-sm font-semibold">Não foi possível carregar esta lista.</p><Button variant="soft" onClick={onRetry} data-testid="button-retry-list">Tentar novamente</Button></div>;
  if (empty) return <EmptyState icon={icon} title={emptyTitle} text={emptyText} onAdd={onAdd} action={addLabel} />;
  return <>{children}</>;
}

function ProductsTable({ products, onEdit, onToggle }: { products: Product[]; onEdit: (product: Product) => void; onToggle: (product: Product) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <tr><th className="px-5 py-3 font-bold">EPI</th><th className="px-3 py-3 font-bold">Categoria de EPI</th><th className="px-3 py-3 font-bold">Estoque</th><th className="px-3 py-3 font-bold">Custo</th><th className="px-3 py-3 font-bold">Situação</th><th className="px-5 py-3 text-right font-bold">Ação</th></tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.map((product) => {
            const low = product.currentStock <= product.minimumStock;
            const overMax = product.currentStock > product.maximumStock;
            return <tr key={product.id} className={`group transition-colors hover:bg-muted/30 ${!product.isActive ? 'opacity-60' : ''}`} data-testid={`row-product-${product.id}`}>
              <td className="px-5 py-4"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${low ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}><Package size={16} /></div><div><p className="font-semibold">{product.name}</p><p className="text-xs text-muted-foreground">Atualizado {date(product.updatedAt)}</p></div></div></td>
              <td className="px-3 py-4 text-sm text-muted-foreground">{product.categoryName}</td>
              <td className="px-3 py-4"><p className={`text-sm font-bold ${low ? 'text-primary' : ''}`}>{number(product.currentStock, product.unit)}</p><p className="text-xs text-muted-foreground">mín. {number(product.minimumStock, product.unit)}</p>{overMax ? <span className="mt-1 block text-[11px] font-semibold text-blue-600" data-testid={`badge-over-max-${product.id}`}>🔵 ESTOQUE ACIMA DO MÁXIMO</span> : null}</td>
              <td className="px-3 py-4 text-sm font-semibold">{money(product.unitCost)}</td>
              <td className="px-3 py-4"><StatusPill active={product.isActive} />{low && product.isActive ? <span className="mt-1 block text-[11px] font-semibold text-primary">Reposição necessária</span> : null}</td>
              <td className="px-5 py-4 text-right"><div className="flex justify-end gap-1"><Button variant="ghost" className="h-9 min-h-9 px-2" onClick={() => onEdit(product)} data-testid={`button-edit-product-${product.id}`}><Edit3 size={15} /><span className="sr-only">Editar</span></Button><Button variant={product.isActive ? 'danger' : 'soft'} className="h-9 min-h-9 px-2.5 text-xs" onClick={() => onToggle(product)} data-testid={`button-toggle-product-${product.id}`}>{product.isActive ? 'Desativar' : 'Ativar'}</Button></div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

function CatalogWorkspace({ focus }: { focus: Focus }) {
  const [, setLocation] = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Product | Category | Supplier | undefined>();
  const [notice, setNotice] = useState<Notice>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [onlyActive, setOnlyActive] = useState(false);
  const queryClient = useQueryClient();

  const productParams = useMemo(() => ({ search: search || undefined, categoryId: categoryFilter === 'all' ? undefined : Number(categoryFilter), activeOnly: onlyActive || undefined }), [search, categoryFilter, onlyActive]);
  const productsQuery = useListProducts(productParams);
  const categoriesQuery = useListCategories({ activeOnly: onlyActive || undefined });
  const suppliersQuery = useListSuppliers({ activeOnly: onlyActive || undefined });
  const summaryQuery = useGetCatalogSummary();
  const updateProduct = useUpdateProduct();
  const updateCategory = useUpdateCategory();
  const updateSupplier = useUpdateSupplier();
  const products = productsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const summary = summaryQuery.data as CatalogSummary | undefined;

  const notify = (value: Notice) => {
    setNotice(value);
    window.setTimeout(() => setNotice(null), 3500);
  };
  const open = (kind: Modal, item?: Product | Category | Supplier) => { setEditing(item); setModal(kind); };
  const close = () => { setModal(null); setEditing(undefined); };
  const toggle = (kind: 'product' | 'category' | 'supplier', item: Product | Category | Supplier) => {
    if ((item as Product | Category | Supplier).isActive && !window.confirm(`Desativar ${kind === 'product' ? 'este EPI' : kind === 'category' ? 'esta categoria de EPI' : 'este fornecedor de EPI'}? Ele continuará visível no histórico como desativado.`)) return;
    const finish = () => {
      queryClient.invalidateQueries({ queryKey: kind === 'product' ? getListProductsQueryKey() : kind === 'category' ? getListCategoriesQueryKey() : getListSuppliersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCatalogSummaryQueryKey() });
      notify({ tone: 'success', text: (item as Product | Category | Supplier).isActive ? 'Item desativado.' : 'Item ativado.' });
    };
    if (kind === 'product') updateProduct.mutate({ id: item.id, data: { isActive: !item.isActive } }, { onSuccess: finish, onError: () => notify({ tone: 'error', text: 'Não foi possível alterar a situação.' }) });
    if (kind === 'category') updateCategory.mutate({ id: item.id, data: { isActive: !item.isActive } }, { onSuccess: finish, onError: () => notify({ tone: 'error', text: 'Não foi possível alterar a situação.' }) });
    if (kind === 'supplier') updateSupplier.mutate({ id: item.id, data: { isActive: !item.isActive } }, { onSuccess: finish, onError: () => notify({ tone: 'error', text: 'Não foi possível alterar a situação.' }) });
  };
  const pageTitle = focus === 'dashboard' ? 'Controle de EPIs' : focus === 'products' ? 'EPIs' : focus === 'categories' ? 'Categorias de EPI' : 'Fornecedores de EPI';
  const pageDescription = focus === 'dashboard' ? 'Visão geral do estoque de equipamentos de proteção individual.' : focus === 'products' ? 'Controle cadastro, custos e níveis de estoque de cada EPI.' : focus === 'categories' ? 'Organize os EPIs por categorias de proteção e uso.' : 'Mantenha os contatos dos fornecedores de EPI sempre à mão.';
  const productsVisible = focus === 'dashboard' || focus === 'products';
  const categoriesVisible = focus === 'dashboard' || focus === 'categories';
  const suppliersVisible = focus === 'dashboard' || focus === 'suppliers';

  return (
    <div className="paper-noise min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-24 items-center gap-3 border-b border-sidebar-border px-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Store size={20} /></div>
          <div><p className="font-serif text-lg font-bold leading-none">SESÉ</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/50">Gestão de EPIs</p></div>
        </div>
        <div className="flex-1 px-4 py-7">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/40">ESTOQUE DE SEGURANÇA</p>
          <nav className="space-y-1">
            {navItems.map((item) => { const Icon = item.icon; const active = focus === item.focus; return <Link key={item.href} href={item.href} onClick={() => setMobileNav(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`} data-testid={`link-nav-${item.focus}`}><Icon size={17} /><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}</Link>; })}
          </nav>
          <p className="mb-3 mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/40">Operação</p>
          <nav className="space-y-1">
            <Link href="/movimentacoes" onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent/70 hover:text-sidebar-foreground" data-testid="link-nav-movements"><ArrowDownToLine size={17} /><span>Movimentações</span></Link>
            <Link href="/colaboradores" onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent/70 hover:text-sidebar-foreground" data-testid="link-nav-collaborators"><UserRoundSearch size={17} /><span>Histórico por Colaborador</span></Link>
            <Link href="/alertas" onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent/70 hover:text-sidebar-foreground" data-testid="link-nav-alerts"><Bell size={17} /><span>Alertas</span></Link>
            <Link href="/compras" onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/65 transition hover:bg-sidebar-accent/70 hover:text-sidebar-foreground" data-testid="link-nav-purchase-list"><ShoppingCart size={17} /><span>Reposição de EPIs de Segurança</span></Link>
          </nav>

          <div className="mt-10 rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-primary"><ShieldCheck size={16} /><span className="text-xs font-bold">Estoque controlado</span></div>
            <p className="text-xs leading-5 text-sidebar-foreground/55">EPIs desativados ficam preservados para manter o histórico de movimentações.</p>
          </div>
        </div>
        <div className="border-t border-sidebar-border p-5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">SE</div><div><p className="text-sm font-bold">Segurança do Trabalho</p><p className="text-xs text-sidebar-foreground/45">Controle de EPIs</p></div><Settings2 size={16} className="ml-auto text-sidebar-foreground/40" /></div></div>
      </aside>

      <div className="lg:pl-[250px]">
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
          <div className="flex h-[72px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
            <div className="flex items-center gap-3"><Button variant="ghost" className="h-10 min-h-10 w-10 rounded-xl p-0 lg:hidden" onClick={() => setMobileNav(true)} data-testid="button-open-mobile-nav"><Menu size={19} /></Button><div className="lg:hidden"><p className="font-serif font-bold">SESÉ</p><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Gestão de EPIs</p></div><div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex"><Database size={15} /><span>Estoque de EPI</span><ChevronDown size={14} /><span className="font-semibold text-foreground">{pageTitle}</span></div></div>
            <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full bg-accent/10 px-3 py-2 text-xs font-bold text-accent sm:flex"><span className="h-2 w-2 rounded-full bg-accent" /> Sistema online</div><Button variant="soft" className="h-10 min-h-10 px-3" onClick={() => open(focus === 'categories' ? 'category' : focus === 'suppliers' ? 'supplier' : 'product')} data-testid={focus === 'categories' ? 'button-header-add-category' : focus === 'suppliers' ? 'button-header-add-supplier' : 'button-header-add-product'}><Plus size={16} /><span className="hidden sm:inline">{focus === 'categories' ? 'Nova Categoria' : focus === 'suppliers' ? 'Novo Fornecedor' : 'Novo EPI'}</span></Button></div>
          </div>
        </header>

        <main className="workspace-grid min-h-[calc(100dvh-72px)] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
          <div className="mx-auto max-w-[1360px]">
            <div className="animate-rise mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">{focus === 'dashboard' ? 'Segurança em primeiro lugar' : 'Gestão de EPIs'}</p><h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">{pageTitle}</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">{pageDescription}</p></div>{focus === 'dashboard' ? <Button onClick={() => open('product')} data-testid="button-add-product-hero"><CirclePlus size={17} /> Adicionar EPI</Button> : null}</div>

            {notice ? <div className={`animate-rise mb-5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'success' ? 'border-accent/20 bg-accent/10 text-accent' : 'border-destructive/20 bg-destructive/10 text-destructive'}`} data-testid="status-notice"><Check size={16} /> {notice.text}</div> : null}

            {focus === 'dashboard' ? <section className="animate-rise animate-rise-delay-1 mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="EPIs ativos" value={`${summary?.activeProducts ?? 0}`} detail={`${summary?.totalProducts ?? 0} cadastrados no total`} icon={Package} accent="bg-primary/10 text-primary" loading={summaryQuery.isLoading} />
              <SummaryCard label="Categorias de EPI" value={`${summary?.activeCategories ?? 0}`} detail="categorias de EPI ativas" icon={Tags} accent="bg-accent/10 text-accent" loading={summaryQuery.isLoading} />
              <SummaryCard label="Fornecedores de EPI" value={`${summary?.activeSuppliers ?? 0}`} detail="contatos disponíveis para compra" icon={Truck} accent="bg-secondary text-secondary-foreground" loading={summaryQuery.isLoading} />
              <SummaryCard label="Valor em estoque" value={money(summary?.totalStockValue)} detail="custo estimado dos itens atuais" icon={Boxes} accent="bg-primary/10 text-primary" loading={summaryQuery.isLoading} />
            </section> : null}

            {(productsVisible || categoriesVisible || suppliersVisible) && <section className="animate-rise animate-rise-delay-2 rounded-2xl border border-border bg-card shadow-[0_15px_40px_-30px_hsl(var(--foreground)/.4)]">
              <div className="flex flex-col gap-4 border-b border-border p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div><h2 className="font-serif text-xl font-bold">{focus === 'dashboard' ? 'EPIs em estoque' : pageTitle}</h2><p className="mt-1 text-xs text-muted-foreground">{focus === 'products' ? 'Use a busca para localizar qualquer EPI em segundos.' : 'Última atualização refletida automaticamente.'}</p></div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {productsVisible ? <div className="relative min-w-0 sm:w-64"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-9`} placeholder="Buscar EPI..." data-testid="input-search-products" /></div> : null}
                  {productsVisible ? <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={`${inputClass} sm:w-44`} data-testid="select-filter-category"><option value="all">Todas as categorias de EPI</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select> : null}
                  <Button variant={onlyActive ? 'primary' : 'soft'} className="whitespace-nowrap" onClick={() => setOnlyActive((current) => !current)} data-testid="button-toggle-active-filter">{onlyActive ? <Check size={15} /> : <Archive size={15} />} {onlyActive ? 'Só ativos' : 'Todos os itens'}</Button>
                </div>
              </div>

              {productsVisible ? <TableState loading={productsQuery.isLoading} error={productsQuery.isError} empty={!products.length} onRetry={() => productsQuery.refetch()} onAdd={() => open('product')} icon={Package} emptyTitle={search ? 'Nenhum EPI encontrado' : 'Seu controle de EPIs começa aqui'} emptyText={search ? 'Tente outro termo ou remova os filtros para ampliar a busca.' : 'Cadastre os equipamentos de proteção usados pela equipe e acompanhe os níveis de estoque.'} addLabel="Adicionar EPI"><ProductsTable products={products} onEdit={(product) => open('product', product)} onToggle={(product) => toggle('product', product)} /></TableState> : null}

              {categoriesVisible && !productsVisible ? <CategoryList categories={categories} loading={categoriesQuery.isLoading} error={categoriesQuery.isError} onRetry={() => categoriesQuery.refetch()} onAdd={() => open('category')} onEdit={(category) => open('category', category)} onToggle={(category) => toggle('category', category)} /> : null}
              {suppliersVisible && !productsVisible ? <SupplierList suppliers={suppliers} loading={suppliersQuery.isLoading} error={suppliersQuery.isError} onRetry={() => suppliersQuery.refetch()} onAdd={() => open('supplier')} onEdit={(supplier) => open('supplier', supplier)} onToggle={(supplier) => toggle('supplier', supplier)} /> : null}
            </section>}

            {focus === 'dashboard' ? <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
              <section className="rounded-2xl border border-border bg-card p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Atenção da semana</p><h2 className="mt-1 font-serif text-xl font-bold">Estoque pedindo cuidado</h2></div><ArrowDownToLine size={20} className="text-primary" /></div>{products.filter((item) => item.isActive && item.currentStock <= item.minimumStock).slice(0, 4).map((item) => <div key={item.id} className="flex items-center justify-between border-t border-border py-3.5"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><CircleAlert size={15} /></div><div><p className="text-sm font-semibold">{item.name}</p><p className="text-xs text-muted-foreground">{item.categoryName} · mínimo {number(item.minimumStock, item.unit)}</p></div></div><span className="text-sm font-bold text-primary">{number(item.currentStock, item.unit)}</span></div>)}{products.filter((item) => item.isActive && item.currentStock <= item.minimumStock).length === 0 ? <p className="rounded-xl bg-muted/50 p-5 text-sm text-muted-foreground">Nenhum item abaixo do mínimo. O forno pode seguir tranquilo.</p> : null}</section>
              <section className="rounded-2xl border border-border bg-sidebar p-5 text-sidebar-foreground"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Atalho de rotina</p><h2 className="mt-2 font-serif text-2xl font-bold">EPI disponível, operação segura.</h2><p className="mt-3 text-sm leading-6 text-sidebar-foreground/60">Revise EPIs, fornecedores e níveis mínimos para evitar falta de equipamentos de segurança.</p><div className="mt-6 grid gap-2"><Button variant="soft" className="justify-between bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80" onClick={() => setLocation('/produtos')} data-testid="button-shortcut-products">Revisar EPIs <ArrowUpRight size={15} /></Button><Button variant="soft" className="justify-between bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80" onClick={() => setLocation('/fornecedores')} data-testid="button-shortcut-suppliers">Ver fornecedores de EPI <ArrowUpRight size={15} /></Button></div></section>
            </div> : null}
          </div>
        </main>
      </div>

      {mobileNav ? <div className="fixed inset-0 z-40 bg-foreground/40 lg:hidden" onClick={() => setMobileNav(false)}><aside className="h-full w-[290px] bg-sidebar p-5 text-sidebar-foreground" onClick={(event) => event.stopPropagation()}><div className="mb-8 flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Store size={20} /></div><p className="font-serif text-lg font-bold">SESÉ</p></div><nav className="space-y-1">{navItems.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid={`link-mobile-nav-${item.focus}`}><Icon size={17} />{item.label}</Link>; })}<Link href="/movimentacoes" onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="link-mobile-nav-movements"><ArrowDownToLine size={17} />Movimentações</Link><Link href="/colaboradores" onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="link-mobile-nav-collaborators"><UserRoundSearch size={17} />Histórico por Colaborador</Link><Link href="/alertas" onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="link-mobile-nav-alerts"><Bell size={17} />Alertas</Link><Link href="/compras" onClick={() => setMobileNav(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="link-mobile-nav-purchase-list"><ShoppingCart size={17} />Reposição de EPIs</Link></nav></aside></div> : null}
      {modal === 'product' ? <ModalFrame title={editing ? 'Editar EPI' : 'Novo EPI'} eyebrow="Estoque · EPI" onClose={close}><ProductForm product={editing as Product | undefined} categories={categories} suppliers={suppliers} onClose={close} onDone={close} notify={notify} /></ModalFrame> : null}
      {modal === 'category' ? <ModalFrame title={editing ? 'Editar categoria de EPI' : 'Nova categoria de EPI'} eyebrow="Estoque · categoria de EPI" onClose={close}><CategoryForm category={editing as Category | undefined} onClose={close} onDone={close} notify={notify} /></ModalFrame> : null}
      {modal === 'supplier' ? <ModalFrame title={editing ? 'Editar fornecedor de EPI' : 'Novo fornecedor de EPI'} eyebrow="Estoque · fornecedor de EPI" onClose={close}><SupplierForm supplier={editing as Supplier | undefined} onClose={close} onDone={close} notify={notify} /></ModalFrame> : null}
    </div>
  );
}

function CategoryList({ categories, loading, error, onRetry, onAdd, onEdit, onToggle }: { categories: Category[]; loading: boolean; error: boolean; onRetry: () => void; onAdd: () => void; onEdit: (category: Category) => void; onToggle: (category: Category) => void }) {
  return <TableState loading={loading} error={error} empty={!categories.length} onRetry={onRetry} onAdd={onAdd} icon={Tags} emptyTitle="Nenhuma categoria de EPI cadastrada" emptyText="Exemplos: Proteção das Mãos, Proteção dos Olhos, Proteção dos Pés, Proteção Auditiva e Proteção Respiratória." addLabel="Adicionar categoria de EPI"><div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <div key={category.id} className={`rounded-2xl border border-border bg-background/60 p-4 transition hover:border-primary/40 ${!category.isActive ? 'opacity-60' : ''}`} data-testid={`card-category-${category.id}`}><div className="flex items-start justify-between"><div className="rounded-xl bg-secondary p-2.5 text-secondary-foreground"><Tags size={17} /></div><StatusPill active={category.isActive} /></div><p className="mt-5 font-serif text-lg font-bold">{category.name}</p><p className="mt-1 text-xs text-muted-foreground">Criada em {date(category.createdAt)}</p><div className="mt-4 flex gap-2 border-t border-border pt-3"><Button variant="ghost" className="h-9 min-h-9 flex-1 text-xs" onClick={() => onEdit(category)} data-testid={`button-edit-category-${category.id}`}><Edit3 size={14} /> Editar</Button><Button variant={category.isActive ? 'danger' : 'soft'} className="h-9 min-h-9 px-2.5 text-xs" onClick={() => onToggle(category)} data-testid={`button-toggle-category-${category.id}`}>{category.isActive ? 'Desativar' : 'Ativar'}</Button></div></div>)}</div></TableState>;
}

function SupplierList({ suppliers, loading, error, onRetry, onAdd, onEdit, onToggle }: { suppliers: Supplier[]; loading: boolean; error: boolean; onRetry: () => void; onAdd: () => void; onEdit: (supplier: Supplier) => void; onToggle: (supplier: Supplier) => void }) {
  return <TableState loading={loading} error={error} empty={!suppliers.length} onRetry={onRetry} onAdd={onAdd} icon={Truck} emptyTitle="Nenhum fornecedor de EPI cadastrado" emptyText="Cadastre os fornecedores responsáveis pelos EPIs de segurança da empresa." addLabel="Adicionar fornecedor de EPI"><div className="divide-y divide-border">{suppliers.map((supplier) => <div key={supplier.id} className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${!supplier.isActive ? 'opacity-60' : ''}`} data-testid={`row-supplier-${supplier.id}`}><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent"><Truck size={19} /></div><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{supplier.name}</p><StatusPill active={supplier.isActive} /></div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{supplier.phone ? <span className="inline-flex items-center gap-1"><Phone size={12} />{supplier.phone}</span> : null}{supplier.email ? <span className="inline-flex items-center gap-1"><Mail size={12} />{supplier.email}</span> : null}{supplier.notes ? <span>{supplier.notes}</span> : null}</div></div></div><div className="flex gap-2 sm:justify-end"><Button variant="ghost" className="h-9 min-h-9 flex-1 text-xs sm:flex-none" onClick={() => onEdit(supplier)} data-testid={`button-edit-supplier-${supplier.id}`}><Edit3 size={14} /> Editar</Button><Button variant={supplier.isActive ? 'danger' : 'soft'} className="h-9 min-h-9 px-2.5 text-xs" onClick={() => onToggle(supplier)} data-testid={`button-toggle-supplier-${supplier.id}`}>{supplier.isActive ? 'Desativar' : 'Ativar'}</Button></div></div>)}</div></TableState>;
}

export function CatalogApp({ focus }: { focus: Focus }) {
  return <CatalogWorkspace focus={focus} />;
}