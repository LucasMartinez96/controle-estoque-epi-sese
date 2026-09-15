import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'catalog-workspace.tsx'), 'utf8');

assert.match(
  source,
  /focus === 'categories'[\s\S]{0,500}open\('category'\)[\s\S]{0,500}Nova Categoria/,
  'Na página Categorias de EPI, a ação do cabeçalho deve abrir o formulário de categoria e exibir “Nova Categoria”.',
);

assert.match(
  source,
  /focus === 'products'[\s\S]{0,500}open\('product'\)[\s\S]{0,500}Novo EPI/,
  'Na página de EPIs, a ação do cabeçalho deve continuar cadastrando EPI.',
);
