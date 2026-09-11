# Controle de Estoque para Pizzaria

Sistema de controle de estoque para pizzarias, com rastreabilidade de movimentações, alertas e lista de compras.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — aplica o schema do banco de desenvolvimento
- `pnpm --filter @workspace/db run seed` — cria categorias, fornecedores e produtos fictícios iniciais
- Required env: `DATABASE_URL` — conexão com o PostgreSQL gerenciado

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/` — tabelas, relacionamentos, tipos e schemas de entrada
- `lib/db/src/seed.ts` — dados iniciais idempotentes para desenvolvimento
- `artifacts/api-server/` — API HTTP compartilhada
- `lib/api-spec/openapi.yaml` — contrato único da API

## Architecture decisions

- O saldo atual fica no produto para leituras rápidas, mas cada alteração exige uma movimentação com saldo anterior e posterior.
- Status de estoque não é armazenado: será derivado do saldo, mínimo e configuração de atenção, evitando inconsistência.
- O banco de desenvolvimento usa PostgreSQL gerenciado com Drizzle ORM, mantendo tipos e tabelas portáveis para uma futura migração controlada.
- Alertas possuem estados aberto/resolvido para impedir duplicação enquanto a situação crítica permanecer ativa.
- A autenticação será conectada posteriormente a um provedor gerenciado; o schema já suporta o usuário responsável por cada operação.

## Product

Na Etapa 1, a base de dados suporta produtos, categorias, fornecedores, configurações de estoque, movimentações, alertas e itens da lista de compras. As telas e serviços de negócio serão adicionados por etapas.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
