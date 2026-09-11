# EPI: CA, fabricante, tamanho, lote e validade

- Cadastro: CA e fabricante obrigatórios; tamanho opcional.
- Novo EPI começa com estoque zero.
- Entrada exige lote e validade.
- Cada entrada cria saldo em `inventory_lots`.
- Saídas consomem lotes por FEFO (validade mais próxima primeiro).
- Ajuste negativo também consome FEFO; ajuste positivo cria lote técnico `AJUSTE-*`.
- Mínimo/máximo, alertas, reposição e Telegram continuam usando o saldo geral do EPI.
