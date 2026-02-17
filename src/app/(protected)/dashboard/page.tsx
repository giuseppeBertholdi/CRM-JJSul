import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const scopeFilter =
    user.role === "ADMIN" || !user.departmentId
      ? {}
      : { departmentId: user.departmentId };

  const [openAttendances, groupedByDepartment, conversations, activeCustomers] =
    await Promise.all([
      prisma.conversation.count({
        where: {
          ...scopeFilter,
          status: {
            in: ["OPEN", "WAITING", "QUOTE_SENT"],
          },
        },
      }),
      prisma.conversation.groupBy({
        by: ["departmentId"],
        where: scopeFilter,
        _count: { _all: true },
      }),
      prisma.conversation.findMany({
        where: scopeFilter,
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: 1,
          },
        },
        take: 200,
      }),
      prisma.customer.count({
        where: {
          conversations: {
            some: {
              ...scopeFilter,
              lastMessageAt: {
                gte: subDays(new Date(), 30),
              },
            },
          },
        },
      }),
    ]);

  const departments = await prisma.department.findMany({
    where:
      user.role === "ADMIN" || !user.departmentId
        ? undefined
        : { id: user.departmentId },
  });
  const departmentMap = new Map(departments.map((item) => [item.id, item.name]));

  const avgResponseMinutes = conversations.length
    ? Number(
        (
          conversations.reduce((acc, conversation) => {
            const firstMessage = conversation.messages[0];
            if (!firstMessage) return acc;
            const minutes =
              (firstMessage.createdAt.getTime() - conversation.createdAt.getTime()) /
              1000 /
              60;
            return acc + Math.max(0, minutes);
          }, 0) / conversations.length
        ).toFixed(2)
      )
    : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Visão geral dos atendimentos por setor.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Atendimentos abertos" value={openAttendances} />
        <MetricCard title="Clientes ativos (30 dias)" value={activeCustomers} />
        <MetricCard title="Tempo médio de resposta" value={`${avgResponseMinutes} min`} />
        <MetricCard title="Setores com conversas" value={groupedByDepartment.length} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Atendimentos por setor
        </h2>
        <div className="space-y-3">
          {groupedByDepartment.map((item) => (
            <div
              key={item.departmentId}
              className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
            >
              <span className="text-sm text-slate-700">
                {departmentMap.get(item.departmentId) ?? "Desconhecido"}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                {item._count._all}
              </span>
            </div>
          ))}
          {groupedByDepartment.length === 0 ? (
            <p className="text-sm text-slate-500">Sem dados para exibir.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string | number }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}
