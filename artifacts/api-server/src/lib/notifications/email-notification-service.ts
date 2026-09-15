const LOW_STOCK_RECIPIENTS = [
  "lucas.martinez@gruposese.com",
  "fernando.rsanchez@gruposese.com",
];

export interface LowStockEmailInput {
  productId: number;
  alertId: number;
  productName: string;
  ca?: string | null;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildLowStockEmail(input: LowStockEmailInput) {
  const suggestedQuantity = Math.max(0, input.maximumStock - input.currentStock);
  const ca = input.ca?.trim() || "Não informado";
  const subject = `⚠️ Estoque mínimo — ${input.productName}`;
  const text = [
    "SESÉ | Alerta de Estoque de EPI",
    "",
    `EPI: ${input.productName}`,
    `CA: ${ca}`,
    `Saldo atual: ${input.currentStock} ${input.unit}`,
    `Estoque mínimo: ${input.minimumStock} ${input.unit}`,
    `Sugestão de reposição: ${suggestedQuantity} ${input.unit}`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172033">
      <div style="background:#0b5ed7;color:white;padding:20px 24px;border-radius:12px 12px 0 0">
        <strong>SESÉ | Controle de EPIs</strong>
        <h2 style="margin:8px 0 0">⚠️ Estoque mínimo atingido</h2>
      </div>
      <div style="border:1px solid #dce3ee;border-top:0;padding:24px;border-radius:0 0 12px 12px">
        <p><strong>EPI:</strong> ${escapeHtml(input.productName)}</p>
        <p><strong>CA:</strong> ${escapeHtml(ca)}</p>
        <p><strong>Saldo atual:</strong> ${input.currentStock} ${escapeHtml(input.unit)}</p>
        <p><strong>Estoque mínimo:</strong> ${input.minimumStock} ${escapeHtml(input.unit)}</p>
        <p><strong>Sugestão de reposição:</strong> ${suggestedQuantity} ${escapeHtml(input.unit)}</p>
        <p style="color:#687386;font-size:13px;margin-top:24px">Este aviso é enviado uma vez por ciclo de estoque baixo. Após reposição acima do mínimo, um novo alerta poderá ser enviado em uma próxima queda.</p>
      </div>
    </div>`;
  return { subject, text, html };
}

export async function notifyLowStockByEmail(input: LowStockEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM?.trim();

  if (!apiKey) {
    console.error("[email-notification] RESEND_API_KEY não configurada; envio ignorado.");
    return;
  }
  if (!from) {
    console.error("[email-notification] RESEND_FROM não configurado; envio ignorado.");
    return;
  }

  const message = buildLowStockEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: LOW_STOCK_RECIPIENTS,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend retornou HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const result = (await response.json()) as { id?: string };
  console.log("[email-notification] Alerta de estoque mínimo enviado.", {
    productId: input.productId,
    alertId: input.alertId,
    providerMessageId: result.id,
    recipients: LOW_STOCK_RECIPIENTS,
  });
}
