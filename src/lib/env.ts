const tokenHours = Number(process.env.RESET_PASSWORD_TOKEN_HOURS ?? "2");

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  REDIS_URL: process.env.REDIS_URL,
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME ?? "crm_session",
  RESET_PASSWORD_TOKEN_HOURS:
    Number.isFinite(tokenHours) && tokenHours > 0 ? tokenHours : 2,
};
