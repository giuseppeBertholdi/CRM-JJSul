import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/activity-log";

type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: {
          phone_number_id?: string;
        };
        contacts?: Array<{
          wa_id?: string;
          profile?: {
            name?: string;
          };
        }>;
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: {
            button_reply?: { title?: string };
            list_reply?: { title?: string };
          };
          timestamp?: string;
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
        }>;
      };
    }>;
  }>;
};

function getDepartmentFallbackId() {
  if (env.WHATSAPP_DEFAULT_DEPARTMENT_ID) {
    return env.WHATSAPP_DEFAULT_DEPARTMENT_ID;
  }
  return null;
}

function extractIncomingMessageContent(
  message: NonNullable<
    NonNullable<
      NonNullable<WhatsAppWebhookPayload["entry"]>[number]["changes"]
    >[number]["value"]
  >["messages"][number]
) {
  if (message.type === "text") return message.text?.body ?? "";
  if (message.type === "button") return message.button?.text ?? "";
  if (message.type === "interactive") {
    return (
      message.interactive?.button_reply?.title ??
      message.interactive?.list_reply?.title ??
      ""
    );
  }
  return `[Mensagem ${message.type ?? "desconhecida"} recebida no WhatsApp]`;
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    env.WHATSAPP_VERIFY_TOKEN &&
    token === env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new NextResponse(challenge ?? "ok", { status: 200 });
  }

  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as
    | WhatsAppWebhookPayload
    | null;

  if (!payload?.entry?.length) {
    return jsonOk({ received: true });
  }

  for (const entry of payload.entry) {
    const changes = entry.changes ?? [];
    for (const change of changes) {
      if (change.field !== "messages") {
        continue;
      }
      const value = change.value;
      if (!value) continue;

      const contactsByWaId = new Map(
        (value.contacts ?? [])
          .filter((contact) => Boolean(contact.wa_id))
          .map((contact) => [
            contact.wa_id as string,
            contact.profile?.name ?? "Cliente WhatsApp",
          ])
      );

      for (const status of value.statuses ?? []) {
        if (!status.id || !status.status) continue;
        await prisma.message.updateMany({
          where: { externalMessageId: status.id },
          data: { deliveryStatus: status.status },
        });
      }

      for (const message of value.messages ?? []) {
        if (!message.from) continue;
        const fromWaId = message.from;
        const externalMessageId = message.id ?? null;
        const content = extractIncomingMessageContent(message).trim();
        if (!content) continue;

        if (externalMessageId) {
          const existingMessage = await prisma.message.findFirst({
            where: { externalMessageId },
            select: { id: true },
          });
          if (existingMessage) continue;
        }

        const profileName = contactsByWaId.get(fromWaId) ?? `Contato ${fromWaId}`;

        let customer = await prisma.customer.findUnique({
          where: { whatsappId: fromWaId },
        });

        if (!customer) {
          customer = await prisma.customer.create({
            data: {
              name: profileName,
              phone: `+${fromWaId}`,
              whatsappId: fromWaId,
              notes: "Contato criado automaticamente via webhook WhatsApp.",
            },
          });
        }

        let departmentId = getDepartmentFallbackId();
        if (departmentId) {
          const exists = await prisma.department.findUnique({
            where: { id: departmentId },
            select: { id: true },
          });
          if (!exists) departmentId = null;
        }

        if (!departmentId) {
          const firstDepartment = await prisma.department.findFirst({
            orderBy: { createdAt: "asc" },
            select: { id: true },
          });
          departmentId = firstDepartment?.id ?? null;
        }

        if (!departmentId) {
          continue;
        }

        let conversation = await prisma.conversation.findFirst({
          where: {
            customerId: customer.id,
            channel: "WHATSAPP",
            status: {
              in: ["OPEN", "WAITING", "QUOTE_SENT"],
            },
          },
          orderBy: { lastMessageAt: "desc" },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              customerId: customer.id,
              departmentId,
              status: "OPEN",
              channel: "WHATSAPP",
              externalThreadId: fromWaId,
              whatsappPhoneNumberId: value.metadata?.phone_number_id ?? null,
              lastMessageAt: new Date(),
            },
          });
        }

        const createdMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderType: "CUSTOMER",
            channel: "WHATSAPP",
            direction: "INBOUND",
            content,
            externalMessageId,
            deliveryStatus: "RECEIVED",
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: new Date(),
            externalThreadId: fromWaId,
            whatsappPhoneNumberId:
              value.metadata?.phone_number_id ??
              conversation.whatsappPhoneNumberId ??
              null,
          },
        });

        await logAction({
          action: "WHATSAPP_INBOUND_MESSAGE",
          entity: "Message",
          entityId: createdMessage.id,
          metadata: {
            conversationId: conversation.id,
            customerId: customer.id,
            fromWaId,
          },
        });
      }
    }
  }

  return jsonOk({ received: true });
}
