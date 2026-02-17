import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { Inbox } from "@/components/conversations/inbox";

export default async function ConversationsPage() {
  const user = await requireCurrentUser();
  const scopeFilter =
    user.role === "ADMIN" || !user.departmentId
      ? {}
      : { departmentId: user.departmentId };

  const [conversations, customers, departments, users] = await Promise.all([
    prisma.conversation.findMany({
      where: scopeFilter,
      include: {
        customer: true,
        department: true,
        assignedTo: {
          select: { id: true, name: true, role: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 50,
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.department.findMany({
      where:
        user.role === "ADMIN" || !user.departmentId
          ? undefined
          : { id: user.departmentId },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where:
        user.role === "ADMIN" || !user.departmentId
          ? undefined
          : { departmentId: user.departmentId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        departmentId: true,
      },
    }),
  ]);

  const serializedConversations = JSON.parse(JSON.stringify(conversations));
  const serializedCustomers = JSON.parse(JSON.stringify(customers));
  const serializedDepartments = JSON.parse(JSON.stringify(departments));
  const serializedUsers = JSON.parse(JSON.stringify(users));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          Inbox de Atendimento
        </h1>
        <p className="text-sm text-slate-500">
          Organize conversas por setor e atenda canais internos e WhatsApp.
        </p>
      </header>

      <Inbox
        initialConversations={serializedConversations}
        customers={serializedCustomers}
        departments={serializedDepartments}
        users={serializedUsers}
        currentUser={{
          role: user.role,
          departmentId: user.departmentId,
        }}
      />
    </div>
  );
}
