import { suggestedPurchaseQuantity } from "../purchase";

export interface LowStockMessageInput {
  productName: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Monta o texto da notificação de estoque baixo. Função pura: só
 * formata a mensagem a partir dos dados recebidos — não decide se deve
 * notificar, não envia nada e não sabe nada sobre provedor/config.
 * Centraliza o texto aqui para não espalhar strings pelo código.
 *
 * Reaproveita suggestedPurchaseQuantity (mesma regra usada na Lista de
 * Compras) em vez de recalcular a quantidade sugerida de outro jeito.
 */
export function buildLowStockMessage(input: LowStockMessageInput): string {
  const suggested = suggestedPurchaseQuantity(
    input.currentStock,
    input.maximumStock,
  );

  return [
    "🚨 ALERTA DE ESTOQUE MÍNIMO",
    "",
    `Produto: ${input.productName}`,
    `Estoque atual: ${formatQuantity(input.currentStock)} ${input.unit}`,
    `Estoque mínimo: ${formatQuantity(input.minimumStock)} ${input.unit}`,
    `Estoque máximo: ${formatQuantity(input.maximumStock)} ${input.unit}`,
    "",
    `🛒 Quantidade sugerida para compra: ${formatQuantity(suggested)} ${input.unit}`,
  ].join("\n");
}
