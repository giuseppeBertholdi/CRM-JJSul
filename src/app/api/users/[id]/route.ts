import { z } from "zod";
import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { ROLES } from "@/lib/constants";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  departmentId: z.string().nullable().optional(),
  password: z.string().min(6).optional(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, { params }: Params) {
  const user = await getApiUser(request);
  if (!user) return jsonError("Não autenticado.", 401);
  if (!canManageUsers(user.role)) return jsonError("Sem permissão.", 403);

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Dados inválidos.", 400);
  }

  const data: {
    name?: string;
    role?: (typeof ROLES)[number];
    departmentId?: string | null;
    passwordHash?: string;
  } = {};

  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.role) data.role = parsed.data.role;
  if (Object.hasOwn(parsed.data, "departmentId")) {
    data.departmentId = parsed.data.departmentId ?? null;
  }
  if (parsed.data.password) {
    data.passwordHash = await hashPassword(parsed.data.password);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data,
  });

  await logAction({
    userId: user.id,
    action: "USER_UPDATE",
    entity: "User",
    entityId: updatedUser.id,
  });

  return jsonOk({ user: updatedUser });
}
