import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/current-user";
import { AutomationsManager } from "@/components/automations/automations-manager";

export default async function AutomationsPage() {
  const user = await requireCurrentUser();

  if (user.role === "ATTENDANT") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Automações</h1>
        <p className="mt-2 text-sm text-slate-500">
          Somente gerentes e administradores podem gerenciar regras automáticas.
        </p>
      </div>
    );
  }

  const [automations, departments] = await Promise.all([
    prisma.automationRule.findMany({
      where:
        user.role === "ADMIN" || !user.departmentId
          ? undefined
          : {
              OR: [{ departmentId: null }, { departmentId: user.departmentId }],
            },
      include: {
        department: true,
        _count: {
          select: { reminderLogs: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.department.findMany({
      where:
        user.role === "ADMIN" || !user.departmentId
          ? undefined
          : { id: user.departmentId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Automações</h1>
        <p className="text-sm text-slate-500">
          Regras para follow-up automático por status.
        </p>
      </header>

      <AutomationsManager
        initialRules={JSON.parse(JSON.stringify(automations))}
        departments={JSON.parse(JSON.stringify(departments))}
        currentUserRole={user.role}
        currentUserDepartmentId={user.departmentId}
      />
    </div>
  );
}
