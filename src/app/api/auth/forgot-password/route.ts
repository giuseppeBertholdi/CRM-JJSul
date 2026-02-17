import crypto from "crypto";
import { addHours } from "date-fns";
import { z } from "zod";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { logAction } from "@/lib/activity-log";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return jsonError("Email inválido.", 400);
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return jsonOk({
      message:
        "Se o email existir na base, você receberá instruções para redefinir a senha.",
    });
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = addHours(new Date(), env.RESET_PASSWORD_TOKEN_HOURS);

  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  await logAction({
    userId: user.id,
    action: "AUTH_FORGOT_PASSWORD",
    entity: "AUTH",
  });

  return jsonOk({
    message:
      "Se o email existir na base, você receberá instruções para redefinir a senha.",
    resetUrl: `${env.APP_URL}/reset-password?token=${token}`,
  });
}
