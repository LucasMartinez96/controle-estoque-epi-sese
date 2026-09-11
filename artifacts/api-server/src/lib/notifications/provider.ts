export interface TelegramSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface TelegramProvider {
  readonly name: string;
  sendMessage(chatId: string, message: string): Promise<TelegramSendResult>;
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  result?: { message_id?: number };
}

/** Envio real usando a API HTTPS oficial do Telegram Bot. */
export class TelegramBotApiProvider implements TelegramProvider {
  readonly name = "telegram-bot-api";

  constructor(private readonly botToken: string) {}

  async sendMessage(
    chatId: string,
    message: string,
  ): Promise<TelegramSendResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            disable_web_page_preview: true,
          }),
          signal: controller.signal,
        },
      );

      let data: TelegramApiResponse = {};
      try {
        data = (await response.json()) as TelegramApiResponse;
      } catch {
        // Resposta sem JSON válido: o status HTTP abaixo ainda será registrado.
      }

      if (!response.ok || data.ok !== true) {
        return {
          success: false,
          error:
            data.description ??
            `Telegram respondeu com HTTP ${response.status}.`,
        };
      }

      return {
        success: true,
        providerMessageId:
          data.result?.message_id !== undefined
            ? String(data.result.message_id)
            : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Falha desconhecida no Telegram.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
