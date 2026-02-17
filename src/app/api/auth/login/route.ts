import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { comparePassword, getSessionCookieConfig, signSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/http";
import { logAction } from "@/lib/activity-log";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Dados de login inválidos.", 400);
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user) {
    return jsonError("Email ou senha inválidos.", 401);
  }

  const isValid = await comparePassword(parsed.data.password, user.passwordHash);
  if (!isValid) {
    return jsonError("Email ou senha inválidos.", 401);
  }

  const token = signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    name: user.name,
  });

  const { name, options } = getSessionCookieConfig();
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    },
  });
  response.cookies.set(name, token, options);

  await logAction({
    userId: user.id,
    action: "AUTH_LOGIN",
    entity: "AUTH",
    metadata: {
      email: user.email,
    },
  });

  return response;
}
