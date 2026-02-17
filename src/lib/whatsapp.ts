import { env } from "@/lib/env";

const GRAPH_API_VERSION = "v22.0";

type WhatsAppSendResult = {
  externalMessageId: string | null;
  raw: unknown;
};

export function isWhatsAppConfigured() {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export function normalizePhoneToWhatsAppId(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.length > 11) return digits;
  return `55${digits}`;
}

export async function sendWhatsAppTextMessage(input: {
  to: string;
  body: string;
  previewUrl?: boolean;
}) {
  if (!isWhatsAppConfigured()) {
    throw new Error(
      "WhatsApp não configurado. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID."
    );
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "text",
        text: {
          body: input.body,
          preview_url: input.previewUrl ?? false,
        },
      }),
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? "Falha ao enviar mensagem para WhatsApp."
    );
  }

  const result: WhatsAppSendResult = {
    externalMessageId: payload?.messages?.[0]?.id ?? null,
    raw: payload,
  };

  return result;
}
