/**
 * Configuração da integração com Telegram Bot API.
 *
 * Credenciais nunca devem ser hardcoded no projeto. Configure no ambiente:
 * - TELEGRAM_BOT_TOKEN            token criado pelo @BotFather
 * - TELEGRAM_CHAT_ID              chat/grupo que receberá os alertas
 * - TELEGRAM_INTEGRATION_ENABLED  "true" para ativar o envio real
 */

export type TelegramIntegrationStatus =
  | "DISABLED"
  | "NOT_CONFIGURED"
  | "READY";

export interface TelegramConfig {
  botToken: string | null;
  chatId: string | null;
  enabled: boolean;
}

function readEnv(name: string): string | null {
  const value = process.env[name];
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function getTelegramConfig(): TelegramConfig {
  return {
    botToken: readEnv("TELEGRAM_BOT_TOKEN"),
    chatId: readEnv("TELEGRAM_CHAT_ID"),
    enabled:
      readEnv("TELEGRAM_INTEGRATION_ENABLED")?.toLowerCase() === "true",
  };
}

export function getIntegrationStatus(
  config: TelegramConfig,
): TelegramIntegrationStatus {
  if (!config.enabled) return "DISABLED";
  if (!config.botToken || !config.chatId) return "NOT_CONFIGURED";
  return "READY";
}

/** Versão segura para logs: nunca expõe o token do bot. */
export function redactConfigForLogging(config: TelegramConfig) {
  return {
    hasBotToken: Boolean(config.botToken),
    chatId: config.chatId,
    enabled: config.enabled,
    status: getIntegrationStatus(config),
  };
}
