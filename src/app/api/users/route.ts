import { z } from "zod";
import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth";
import { getApiUser } from "@/lib/api-auth";
import { logAction } from "@/lib/activity-log";
import { ROLES } from "@/lib/constants";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/rbac";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(ROLES),
  departmentId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return jsonError("Não autenticado.", 401);
  }

  const users = await prisma.user.findMany({
    where:
      user.role === "ADMIN" || !user.departmentId
        ? undefined
        : { departmentId: user.departmentId },
    include: {
      department: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk({
    users: users.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      department: item.department,
      createdAt: item.createdAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) {
    return jsonError("Não autenticado.", 401);
  }
  if (!canManageUsers(user.role)) {
    return jsonError("Sem permissão.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Dados inválidos.", 400);
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const createdUser = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role: parsed.data.role,
      departmentId: parsed.data.departmentId ?? null,
    },
  });

  await logAction({
    userId: user.id,
    action: "USER_CREATE",
    entity: "User",
    entityId: createdUser.id,
  });

  return jsonOk({ user: createdUser }, 201);
}
