export const ROLES = ["ATTENDANT", "MANAGER", "ADMIN"] as const;
export const CONVERSATION_STATUSES = [
  "OPEN",
  "WAITING",
  "CLOSED",
  "QUOTE_SENT",
] as const;
export const CONVERSATION_CHANNELS = ["INTERNAL", "WHATSAPP"] as const;

export const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  ATTENDANT: "Atendente",
  MANAGER: "Gerente",
  ADMIN: "Admin",
};

export const STATUS_LABELS: Record<
  (typeof CONVERSATION_STATUSES)[number],
  string
> = {
  OPEN: "Aberto",
  WAITING: "Aguardando",
  CLOSED: "Fechado",
  QUOTE_SENT: "Cotação enviada",
};

export const CHANNEL_LABELS: Record<
  (typeof CONVERSATION_CHANNELS)[number],
  string
> = {
  INTERNAL: "Interno",
  WHATSAPP: "WhatsApp",
};
