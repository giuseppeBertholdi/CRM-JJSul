import bcrypt from "bcryptjs";
import {
  ConversationStatus,
  PrismaClient,
  Role,
  SenderType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [, vendas] = await Promise.all([
    prisma.department.upsert({
      where: { name: "RH" },
      update: {},
      create: { name: "RH" },
    }),
    prisma.department.upsert({
      where: { name: "Vendas" },
      update: {},
      create: { name: "Vendas" },
    }),
    prisma.department.upsert({
      where: { name: "Consultoria" },
      update: {},
      create: { name: "Consultoria" },
    }),
  ]);

  const defaultPasswordHash = await bcrypt.hash("123456", 10);

  const [admin, gerenteVendas, atendenteVendas] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@jjsul.com" },
      update: {},
      create: {
        name: "Administrador",
        email: "admin@jjsul.com",
        passwordHash: defaultPasswordHash,
        role: Role.ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: "gerente.vendas@jjsul.com" },
      update: {},
      create: {
        name: "Gerente de Vendas",
        email: "gerente.vendas@jjsul.com",
        passwordHash: defaultPasswordHash,
        role: Role.MANAGER,
        departmentId: vendas.id,
      },
    }),
    prisma.user.upsert({
      where: { email: "atendente.vendas@jjsul.com" },
      update: {},
      create: {
        name: "Atendente de Vendas",
        email: "atendente.vendas@jjsul.com",
        passwordHash: defaultPasswordHash,
        role: Role.ATTENDANT,
        departmentId: vendas.id,
      },
    }),
  ]);

  const customersCount = await prisma.customer.count();
  if (customersCount === 0) {
    await prisma.customer.createMany({
      data: [
        {
          name: "Transporte Alfa",
          phone: "(11) 99999-1111",
          email: "contato@alfa.com",
          company: "Alfa Logistica",
          notes: "Cliente recorrente de cargas fechadas.",
        },
        {
          name: "Beta Distribuicao",
          phone: "(11) 99999-2222",
          email: "operacao@beta.com",
          company: "Beta Distribuicao LTDA",
          notes: "Preferencia por contato via WhatsApp.",
        },
      ],
    });
  }

  const firstCustomer = await prisma.customer.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (firstCustomer) {
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        customerId: firstCustomer.id,
      },
    });

    if (!existingConversation) {
      const conversation = await prisma.conversation.create({
        data: {
          customerId: firstCustomer.id,
          departmentId: vendas.id,
          assignedToId: atendenteVendas.id,
          status: ConversationStatus.OPEN,
        },
      });

      await prisma.message.createMany({
        data: [
          {
            conversationId: conversation.id,
            senderId: atendenteVendas.id,
            senderType: SenderType.USER,
            content:
              "Bom dia! Estamos acompanhando sua solicitacao de frete para esta semana.",
          },
          {
            conversationId: conversation.id,
            senderId: gerenteVendas.id,
            senderType: SenderType.USER,
            content:
              "Enviamos a cotacao preliminar. Podemos alinhar os detalhes finais.",
          },
        ],
      });
    }
  }

  const rulesCount = await prisma.automationRule.count();
  if (rulesCount === 0) {
    await prisma.automationRule.create({
      data: {
        triggerStatus: ConversationStatus.QUOTE_SENT,
        delayHours: 24,
        messageTemplate:
          "Follow-up automatico: {{cliente}}, confirmamos se recebeu a cotacao de transporte da {{empresa}}. Atendimento {{atendimentoId}}.",
        isActive: true,
        departmentId: vendas.id,
        createdById: admin.id,
      },
    });
  }

  console.log("Seed concluido com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
