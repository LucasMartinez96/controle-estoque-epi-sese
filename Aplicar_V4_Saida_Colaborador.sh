#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="${1:-$HOME/Controle-Estoque-EPI-SESE-V3}"
cd "$ROOT"

python - <<'PY'
from pathlib import Path
root=Path.cwd()

def patch(path, old, new, count=1):
    p=root/path
    s=p.read_text()
    if new in s:
        print(f'OK já aplicado: {path}')
        return
    if old not in s:
        raise SystemExit(f'Não encontrei o trecho esperado em {path}. Parei sem sobrescrever o arquivo.')
    s=s.replace(old,new,count)
    p.write_text(s)
    print(f'Atualizado: {path}')

patch(Path('lib/db/src/schema/inventory.ts'),
'''    reason: varchar("reason", { length: 160 }),
    notes: text("notes"),''',
'''    recipientName: varchar("recipient_name", { length: 160 }),
    recipientRegistration: varchar("recipient_registration", { length: 60 }),
    reason: varchar("reason", { length: 160 }),
    notes: text("notes"),''')

patch(Path('artifacts/api-server/src/lib/movements.ts'),
'''  expirationDate?: string | null;
}) {''',
'''  expirationDate?: string | null;
  recipientName?: string | null;
  recipientRegistration?: string | null;
}) {''')

patch(Path('artifacts/api-server/src/lib/movements.ts'),
'''      quantity = input.quantity;
      stockAfter = stockBefore - quantity;

      const allowNegative''',
'''      const recipientName = input.recipientName?.trim();
      const recipientRegistration = input.recipientRegistration?.trim();
      if (!recipientName) {
        throw new MovementError("Informe o colaborador que recebeu o EPI.");
      }
      if (!recipientRegistration) {
        throw new MovementError("Informe a matrícula do colaborador.");
      }
      quantity = input.quantity;
      stockAfter = stockBefore - quantity;

      const allowNegative''')

patch(Path('artifacts/api-server/src/lib/movements.ts'),
'''        unitCost: input.unitCost ?? null,
        reason: input.reason ?? null,''',
'''        unitCost: input.unitCost ?? null,
        recipientName: input.type === "EXIT" ? input.recipientName?.trim() || null : null,
        recipientRegistration: input.type === "EXIT" ? input.recipientRegistration?.trim() || null : null,
        reason: input.reason ?? null,''')

patch(Path('lib/api-spec/openapi.yaml'),
'''        unitCost:
          type: ["number", "null"]
        reason:''',
'''        unitCost:
          type: ["number", "null"]
        recipientName:
          type: ["string", "null"]
        recipientRegistration:
          type: ["string", "null"]
        reason:''')

patch(Path('lib/api-spec/openapi.yaml'),
'''      required: [id, productId, productName, unit, type, quantity, stockBefore, stockAfter, adjustmentDifference, occurredAt, supplierId, supplierName, lotCode, expirationDate, unitCost, reason, notes, userId, createdAt]''',
'''      required: [id, productId, productName, unit, type, quantity, stockBefore, stockAfter, adjustmentDifference, occurredAt, supplierId, supplierName, lotCode, expirationDate, unitCost, recipientName, recipientRegistration, reason, notes, userId, createdAt]''')

patch(Path('lib/api-spec/openapi.yaml'),
'''        expirationDate: { type: ["string", "null"], format: date }
        reason:''',
'''        expirationDate: { type: ["string", "null"], format: date }
        recipientName:
          type: ["string", "null"]
          maxLength: 160
          description: Obrigatório para EXIT.
        recipientRegistration:
          type: ["string", "null"]
          maxLength: 60
          description: Obrigatório para EXIT.
        reason:''')

patch(Path('lib/api-zod/src/generated/api.ts'),
'''  "expirationDate": zod.string().nullable(),
  "unitCost": zod.number().nullable(),''',
'''  "expirationDate": zod.string().nullable(),
  "unitCost": zod.number().nullable(),
  "recipientName": zod.string().nullable(),
  "recipientRegistration": zod.string().nullable(),''')

patch(Path('lib/api-zod/src/generated/api.ts'),
'''  "expirationDate": zod.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullish(),
  "reason":''',
'''  "expirationDate": zod.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/).nullish(),
  "recipientName": zod.string().max(160).nullish(),
  "recipientRegistration": zod.string().max(60).nullish(),
  "reason":''')

patch(Path('lib/api-zod/src/generated/types/movement.ts'),
'''  /** @nullable */
  unitCost: number | null;
  /** @nullable */
  reason:''',
'''  /** @nullable */
  unitCost: number | null;
  /** @nullable */
  recipientName: string | null;
  /** @nullable */
  recipientRegistration: string | null;
  /** @nullable */
  reason:''')

patch(Path('lib/api-zod/src/generated/types/movementInput.ts'),
'''  lotCode?: string | null;
  expirationDate?: string | null;
  /** @maxLength 160 */
  reason?:''',
'''  lotCode?: string | null;
  expirationDate?: string | null;
  /** @maxLength 160 */
  recipientName?: string | null;
  /** @maxLength 60 */
  recipientRegistration?: string | null;
  /** @maxLength 160 */
  reason?:''')

patch(Path('lib/api-client-react/src/generated/api.schemas.ts'),
'''  /** @nullable */
  unitCost: number | null;
  /** @nullable */
  reason:''',
'''  /** @nullable */
  unitCost: number | null;
  /** @nullable */
  recipientName: string | null;
  /** @nullable */
  recipientRegistration: string | null;
  /** @nullable */
  reason:''')

patch(Path('lib/api-client-react/src/generated/api.schemas.ts'),
'''  lotCode?: string | null;
  expirationDate?: string | null;
  /**
     * @maxLength 160''',
'''  lotCode?: string | null;
  expirationDate?: string | null;
  /** @nullable */
  recipientName?: string | null;
  /** @nullable */
  recipientRegistration?: string | null;
  /**
     * @maxLength 160''')

patch(Path('artifacts/pizzaria-estoque/src/components/movements-workspace.tsx'),
'''  expirationDate: z.string().optional(),
  reason:''',
'''  expirationDate: z.string().optional(),
  recipientName: z.string().max(160).optional(),
  recipientRegistration: z.string().max(60).optional(),
  reason:''')

patch(Path('artifacts/pizzaria-estoque/src/components/movements-workspace.tsx'),
'''defaultValues: { productId: 0, quantity: 0, unitCost: undefined, lotCode: '', expirationDate: '', reason: '', notes: '' },''',
'''defaultValues: { productId: 0, quantity: 0, unitCost: undefined, lotCode: '', expirationDate: '', recipientName: '', recipientRegistration: '', reason: '', notes: '' },''')

patch(Path('artifacts/pizzaria-estoque/src/components/movements-workspace.tsx'),
'''    create.mutate(
      {
        data: {''',
'''    if (kind === 'EXIT' && !values.recipientName?.trim()) {
      notify({ tone: 'error', text: 'Informe o colaborador que recebeu o EPI.' });
      return;
    }
    if (kind === 'EXIT' && !values.recipientRegistration?.trim()) {
      notify({ tone: 'error', text: 'Informe a matrícula do colaborador.' });
      return;
    }
    create.mutate(
      {
        data: {''')

patch(Path('artifacts/pizzaria-estoque/src/components/movements-workspace.tsx'),
'''          expirationDate: kind === 'ENTRY' ? values.expirationDate || undefined : undefined,
          reason:''',
'''          expirationDate: kind === 'ENTRY' ? values.expirationDate || undefined : undefined,
          recipientName: kind === 'EXIT' ? values.recipientName?.trim() || undefined : undefined,
          recipientRegistration: kind === 'EXIT' ? values.recipientRegistration?.trim() || undefined : undefined,
          reason:''')

patch(Path('artifacts/pizzaria-estoque/src/components/movements-workspace.tsx'),
'''form.reset({ productId: 0, quantity: 0, unitCost: undefined, lotCode: '', expirationDate: '', reason: '', notes: '' });''',
'''form.reset({ productId: 0, quantity: 0, unitCost: undefined, lotCode: '', expirationDate: '', recipientName: '', recipientRegistration: '', reason: '', notes: '' });''')

patch(Path('artifacts/pizzaria-estoque/src/components/movements-workspace.tsx'),
'''      <Field label="Motivo (opcional)" error={form.formState.errors.reason?.message}>''',
'''      {kind === 'EXIT' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Colaborador" error={form.formState.errors.recipientName?.message} hint="Obrigatório na saída">
            <input {...form.register('recipientName')} className={inputClass} placeholder="Ex.: João da Silva" data-testid="input-exit-recipient-name" />
          </Field>
          <Field label="Matrícula" error={form.formState.errors.recipientRegistration?.message} hint="Obrigatória na saída">
            <input {...form.register('recipientRegistration')} className={inputClass} placeholder="Ex.: 123456" data-testid="input-exit-recipient-registration" />
          </Field>
        </div>
      ) : null}
      <Field label="Motivo (opcional)" error={form.formState.errors.reason?.message}>''')

patch(Path('artifacts/pizzaria-estoque/src/components/movements-workspace.tsx'),
'''{movement.reason ? <p className="text-xs text-muted-foreground">{movement.reason}</p> : null}</td>''',
'''{movement.type === 'EXIT' && movement.recipientName ? <p className="text-xs font-medium text-muted-foreground">Entregue a {movement.recipientName}{movement.recipientRegistration ? ` · Matrícula ${movement.recipientRegistration}` : ''}</p> : null}{movement.reason ? <p className="text-xs text-muted-foreground">{movement.reason}</p> : null}</td>''')

print('V4 aplicada nos arquivos.')
PY

echo
echo "Atualizando banco..."
pnpm --filter @workspace/db run push

echo
echo "V4 aplicada. Agora reinicie Backend e Frontend."
