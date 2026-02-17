import { z } from "zod";
import { NextRequest } from "next/server";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canAccessDepartment } from "@/lib/rbac";
import {
  normalizePhoneToWhatsAppId,
  sendWhatsAppTextMessage,
} from "@/lib/whatsapp";

const schema = z.object({
  content: z.string().min(1),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Mensagem inválida.", 400);

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: true,
    },
  });
  if (!conversation) return jsonError("Atendimento não encontrado.", 404);

  if (
    !canAccessDepartment(user.role, user.departmentId, conversation.departmentId)
  ) {
    return jsonError("Sem permissão.", 403);
  }

  let externalMessageId: string | null = null;
  let deliveryStatus: string | null = null;

  if (conversation.channel === "WHATSAPP") {
    const recipient =
      conversation.customer.whatsappId ||
      normalizePhoneToWhatsAppId(conversation.customer.phone);

    if (!recipient) {
      return jsonError(
        "Cliente sem número WhatsApp válido. Atualize o telefone do cliente.",
        400
      );
    }

    if (!conversation.customer.whatsappId) {
      await prisma.customer.update({
        where: { id: conversation.customer.id },
        data: { whatsappId: recipient },
      });
    }

    try {
      const sent = await sendWhatsAppTextMessage({
        to: recipient,
        body: parsed.data.content,
      });
      externalMessageId = sent.externalMessageId;
      deliveryStatus = "SENT_TO_WHATSAPP_API";
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Falha ao enviar via WhatsApp.",
        400
      );
    }
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        senderType: "USER",
        channel: conversation.channel,
        direction: conversation.channel === "WHATSAPP" ? "OUTBOUND" : "INTERNAL",
        content: parsed.data.content,
        externalMessageId,
        deliveryStatus,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),
    prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    }),
  ]);

  await logAction({
    userId: user.id,
    action: "MESSAGE_CREATE",
    entity: "Message",
    entityId: message.id,
    metadata: {
      conversationId: conversation.id,
      channel: conversation.channel,
      externalMessageId,
    },
  });

  return jsonOk({ message }, 201);
}
