import { addHours } from "date-fns";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isQueueEnabled, remindersQueue } from "@/lib/queue";
import {
  normalizePhoneToWhatsAppId,
  sendWhatsAppTextMessage,
} from "@/lib/whatsapp";

function buildReminderMessage(
  template: string,
  conversation: {
    id: string;
    customer: {
      name: string;
      company: string | null;
    };
  }
) {
  return template
    .replaceAll("{{cliente}}", conversation.customer.name)
    .replaceAll("{{empresa}}", conversation.customer.company ?? "-")
    .replaceAll("{{atendimentoId}}", conversation.id);
}

export async function scheduleRemindersForConversation(
  conversationId: string,
  triggerStatus: ConversationStatus
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { customer: true },
  });

  if (!conversation) {
    return;
  }

  const rules = await prisma.automationRule.findMany({
    where: {
      isActive: true,
      triggerStatus,
      OR: [{ departmentId: null }, { departmentId: conversation.departmentId }],
    },
  });

  for (const rule of rules) {
    const scheduledFor = addHours(new Date(), rule.delayHours);
    const reminderLog = await prisma.reminderLog.create({
      data: {
        conversationId: conversation.id,
        ruleId: rule.id,
        scheduledFor,
        status: isQueueEnabled() ? "SCHEDULED" : "PENDING_NO_QUEUE",
      },
    });

    if (remindersQueue) {
      const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());
      await remindersQueue.add(
        "send-reminder",
        {
          reminderLogId: reminderLog.id,
          conversationId: conversation.id,
          ruleId: rule.id,
        },
        {
          delay: delayMs,
          attempts: 3,
          backoff: { type: "exponential", delay: 2_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        }
      );
    }
  }
}

export async function dispatchReminder(reminderLogId: string) {
  const reminderLog = await prisma.reminderLog.findUnique({
    where: { id: reminderLogId },
    include: {
      rule: true,
      conversation: {
        include: {
          customer: true,
        },
      },
    },
  });

  if (!reminderLog || reminderLog.sentAt) {
    return;
  }

  if (reminderLog.conversation.status !== reminderLog.rule.triggerStatus) {
    await prisma.reminderLog.update({
      where: { id: reminderLog.id },
      data: {
        status: "SKIPPED_STATUS_CHANGED",
      },
    });
    return;
  }

  const messageContent = buildReminderMessage(
    reminderLog.rule.messageTemplate,
    reminderLog.conversation
  );

  let externalMessageId: string | null = null;
  let deliveryStatus: string | null = null;

  if (reminderLog.conversation.channel === "WHATSAPP") {
    const recipient =
      reminderLog.conversation.customer.whatsappId ||
      normalizePhoneToWhatsAppId(reminderLog.conversation.customer.phone);

    if (!recipient) {
      await prisma.reminderLog.update({
        where: { id: reminderLog.id },
        data: {
          status: "FAILED_NO_WHATSAPP_NUMBER",
        },
      });
      return;
    }

    try {
      const result = await sendWhatsAppTextMessage({
        to: recipient,
        body: messageContent,
      });
      externalMessageId = result.externalMessageId;
      deliveryStatus = "SENT_TO_WHATSAPP_API";
    } catch {
      await prisma.reminderLog.update({
        where: { id: reminderLog.id },
        data: {
          status: "FAILED_WHATSAPP_SEND",
        },
      });
      return;
    }
  }

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: reminderLog.conversation.id,
        senderType: "SYSTEM",
        channel: reminderLog.conversation.channel,
        direction:
          reminderLog.conversation.channel === "WHATSAPP"
            ? "OUTBOUND"
            : "SYSTEM",
        content: messageContent,
        externalMessageId,
        deliveryStatus,
      },
    }),
    prisma.conversation.update({
      where: { id: reminderLog.conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    }),
    prisma.reminderLog.update({
      where: { id: reminderLog.id },
      data: {
        sentAt: new Date(),
        status: "SENT",
      },
    }),
  ]);
}
