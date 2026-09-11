# Configuração do Telegram — alerta de estoque mínimo

A integração envia mensagem somente quando nasce um NOVO alerta com:

`estoque atual <= estoque mínimo`

Enquanto esse alerta continuar aberto, novas saídas abaixo do mínimo não enviam mensagens duplicadas. Quando o estoque volta acima do mínimo, o alerta é resolvido. Se futuramente cair novamente até o mínimo, um novo alerta é criado e uma nova mensagem é enviada.

## Variáveis de ambiente

Configure como Secrets/Environment Variables no ambiente onde o backend roda:

- `TELEGRAM_INTEGRATION_ENABLED=true`
- `TELEGRAM_BOT_TOKEN=<token fornecido pelo BotFather>`
- `TELEGRAM_CHAT_ID=<id do chat que receberá a mensagem>`

Não coloque o token diretamente no código e não publique arquivo `.env` com credenciais reais.

## Como testar

1. Inicie uma conversa com o bot e toque em Start.
2. Configure as três variáveis acima.
3. Reinicie o backend para ele carregar as variáveis.
4. Escolha um produto que esteja acima do mínimo.
5. Registre uma saída/ajuste que faça o estoque ficar igual ou abaixo do mínimo.
6. O sistema cria o alerta e envia uma mensagem no Telegram.

Exemplo:

- Estoque atual: 15
- Mínimo: 10
- Saída: 5
- Novo estoque: 10
- Resultado: cria alerta mínimo e envia Telegram.

Se fizer outra saída e o estoque passar de 10 para 8, não envia de novo porque o mesmo alerta continua aberto.

Depois que uma entrada fizer o estoque subir para 11, o alerta é resolvido. Se cair novamente para 10 ou menos, envia uma nova notificação.
