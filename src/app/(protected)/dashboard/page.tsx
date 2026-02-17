import { subDays } from "date-fns";
import {
  ArrowRightLeft,
  Building2,
  Clock3,
  FolderOpen,
  MessageCircleMore,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { CHANNEL_LABELS } from "@/lib/constants";

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const scopeFilter =
    user.role === "ADMIN" || !user.departmentId
      ? {}
      : { departmentId: user.departmentId };

  const [
    openAttendances,
    groupedByDepartment,
    groupedByChannel,
    conversations,
    activeCustomers,
  ] = await Promise.all([
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
      prisma.conversation.groupBy({
        by: ["channel"],
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
  const totalConversations = groupedByDepartment.reduce(
    (acc, item) => acc + item._count._all,
    0
  );

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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Atendimentos abertos"
          subtitle="Conversas em andamento"
          value={openAttendances}
          icon={<FolderOpen className="h-5 w-5" />}
          tone="blue"
        />
        <MetricCard
          title="Clientes ativos (30 dias)"
          subtitle="Com interação recente"
          value={activeCustomers}
          icon={<Building2 className="h-5 w-5" />}
          tone="emerald"
        />
        <MetricCard
          title="Tempo médio de resposta"
          subtitle="Primeiro retorno"
          value={`${avgResponseMinutes} min`}
          icon={<Clock3 className="h-5 w-5" />}
          tone="amber"
        />
        <MetricCard
          title="Canais ativos"
          subtitle="Interno x WhatsApp"
          value={groupedByChannel.length}
          icon={<ArrowRightLeft className="h-5 w-5" />}
          tone="violet"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Atendimentos por setor</h2>
          <p className="mb-4 text-sm text-slate-500">
            Distribuição atual do volume de conversas.
          </p>
          <div className="space-y-3">
            {groupedByDepartment.map((item) => {
              const percentage = totalConversations
                ? Math.round((item._count._all / totalConversations) * 100)
                : 0;

              return (
                <div key={item.departmentId}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {departmentMap.get(item.departmentId) ?? "Desconhecido"}
                    </span>
                    <span className="text-slate-500">
                      {item._count._all} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-600"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {groupedByDepartment.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados para exibir.</p>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Volume por canal</h2>
          <p className="mb-4 text-sm text-slate-500">
            Compare atendimentos internos com WhatsApp.
          </p>
          <div className="space-y-3">
            {groupedByChannel.map((item) => (
              <div
                key={item.channel}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                  <MessageCircleMore className="h-4 w-4 text-slate-400" />
                  {CHANNEL_LABELS[item.channel]}
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                  {item._count._all}
                </span>
              </div>
            ))}
            {groupedByChannel.length === 0 ? (
              <p className="text-sm text-slate-500">Sem conversas por canal.</p>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function MetricCard({
  title,
  subtitle,
  value,
  icon,
  tone,
}: {
  title: string;
  subtitle: string;
  value: string | number;
  icon: React.ReactNode;
  tone: "blue" | "emerald" | "amber" | "violet";
}) {
  const toneClasses: Record<typeof tone, string> = {
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    violet: "bg-violet-100 text-violet-700",
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-700">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className={`rounded-lg p-2 ${toneClasses[tone]}`}>{icon}</div>
      </div>
      <p className="mt-4 text-3xl font-semibold text-slate-900">{value}</p>
    </article>
  );
}
