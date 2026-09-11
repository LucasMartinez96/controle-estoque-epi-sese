import {
  getIntegrationStatus,
  getTelegramConfig,
  redactConfigForLogging,
} from "./config";
import { buildLowStockMessage, type LowStockMessageInput } from "./message-builder";
import { TelegramBotApiProvider } from "./provider";

export interface LowStockNotificationInput extends LowStockMessageInput {
  productId: number;
  alertId: number;
}

/**
 * Envia uma notificação somente quando um NOVO alerta de estoque mínimo é
 * criado. A deduplicação é feita por lib/alerts.ts: enquanto o alerta estiver
 * OPEN, novas movimentações abaixo do mínimo não geram outra mensagem.
 */
export async function notifyLowStock(
  input: LowStockNotificationInput,
): Promise<void> {
  const config = getTelegramConfig();
  const status = getIntegrationStatus(config);
  const baseLog = {
    productId: input.productId,
    productName: input.productName,
    alertId: input.alertId,
    attemptedAt: new Date().toISOString(),
    config: redactConfigForLogging(config),
  };

  if (status === "DISABLED") {
    console.log("[telegram-notification] Integração desativada; envio ignorado.", {
      ...baseLog,
      status: "SKIPPED_DISABLED",
    });
    return;
  }

  if (status === "NOT_CONFIGURED" || !config.botToken || !config.chatId) {
    console.error("[telegram-notification] Integração ativada, mas incompleta.", {
      ...baseLog,
      status: "SKIPPED_NOT_CONFIGURED",
    });
    return;
  }

  const message = buildLowStockMessage(input);
  const provider = new TelegramBotApiProvider(config.botToken);

  try {
    const result = await provider.sendMessage(config.chatId, message);

    if (result.success) {
      console.log("[telegram-notification] Alerta de estoque mínimo enviado.", {
        ...baseLog,
        status: "SENT",
        provider: provider.name,
        providerMessageId: result.providerMessageId,
      });
      return;
    }

    console.error("[telegram-notification] Falha ao enviar alerta de estoque mínimo.", {
      ...baseLog,
      status: "FAILED",
      provider: provider.name,
      error: result.error,
    });
  } catch (error) {
    // A indisponibilidade do Telegram jamais pode quebrar o estoque.
    console.error("[telegram-notification] Erro inesperado no envio.", {
      ...baseLog,
      status: "ERROR",
      provider: provider.name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
