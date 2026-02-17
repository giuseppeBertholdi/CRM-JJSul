"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpRight,
  Clock3,
  MessageCircle,
  MessageCircleMore,
  Search,
  UserRound,
} from "lucide-react";
import {
  CHANNEL_LABELS,
  CONVERSATION_CHANNELS,
  STATUS_LABELS,
} from "@/lib/constants";

type Role = "ATTENDANT" | "MANAGER" | "ADMIN";
type ConversationStatus = "OPEN" | "WAITING" | "CLOSED" | "QUOTE_SENT";
type ConversationChannel = "INTERNAL" | "WHATSAPP";

type ConversationListItem = {
  id: string;
  status: ConversationStatus;
  channel: ConversationChannel;
  lastMessageAt: string | Date;
  customer: {
    id: string;
    name: string;
    company: string | null;
  };
  department: {
    id: string;
    name: string;
  };
  assignedTo:
    | {
        id: string;
        name: string;
        role: Role;
      }
    | null
    | undefined;
  messages: Array<{
    content: string;
    createdAt: string | Date;
  }>;
};

type ConversationDetail = {
  id: string;
  status: ConversationStatus;
  channel: ConversationChannel;
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string;
    company: string | null;
  };
  department: {
    id: string;
    name: string;
  };
  assignedTo:
    | {
        id: string;
        name: string;
        role: Role;
      }
    | null;
  messages: Array<{
    id: string;
    content: string;
    senderType: "USER" | "CUSTOMER" | "SYSTEM";
    direction: "INBOUND" | "OUTBOUND" | "INTERNAL" | "SYSTEM";
    channel: ConversationChannel;
    deliveryStatus?: string | null;
    createdAt: string | Date;
    sender:
      | {
          id: string;
          name: string;
          role: Role;
        }
      | null;
  }>;
};

type InboxProps = {
  initialConversations: ConversationListItem[];
  customers: Array<{ id: string; name: string; company: string | null }>;
  departments: Array<{ id: string; name: string }>;
  users: Array<{
    id: string;
    name: string;
    role: Role;
    departmentId: string | null;
  }>;
  currentUser: {
    role: Role;
    departmentId: string | null;
  };
};

const STATUS_OPTIONS: ConversationStatus[] = [
  "OPEN",
  "WAITING",
  "QUOTE_SENT",
  "CLOSED",
];

export function Inbox({
  initialConversations,
  customers,
  departments,
  users,
  currentUser,
}: InboxProps) {
  const [conversations, setConversations] =
    useState<ConversationListItem[]>(initialConversations);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversations[0]?.id ?? null);
  const [selectedConversation, setSelectedConversation] =
    useState<ConversationDetail | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<
    ConversationChannel | "ALL"
  >("ALL");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerId: customers[0]?.id ?? "",
    departmentId: departments[0]?.id ?? "",
    assignedToId: users[0]?.id ?? "",
    channel: "INTERNAL" as ConversationChannel,
    initialMessage: "",
  });

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (channelFilter !== "ALL" && conversation.channel !== channelFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      const preview = conversation.messages[0]?.content ?? "";
      return (
        conversation.customer.name.toLowerCase().includes(normalizedQuery) ||
        conversation.department.name.toLowerCase().includes(normalizedQuery) ||
        preview.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [channelFilter, conversations, query]);

  async function refreshConversationList() {
    const response = await fetch("/api/conversations");
    if (!response.ok) return;
    const payload = (await response.json()) as { conversations: ConversationListItem[] };
    setConversations(payload.conversations);
  }

  async function loadConversation(conversationId: string) {
    setLoadingConversation(true);
    setError(null);
    const response = await fetch(`/api/conversations/${conversationId}`);
    setLoadingConversation(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao carregar conversa.");
      return;
    }
    const payload = (await response.json()) as { conversation: ConversationDetail };
    setSelectedConversation(payload.conversation);
  }

  useEffect(() => {
    if (!selectedConversationId) return;
    void loadConversation(selectedConversationId);
  }, [selectedConversationId]);

  const usersForSelectedDepartment = useMemo(() => {
    return users.filter((user) => {
      if (!createForm.departmentId) return true;
      return user.departmentId === createForm.departmentId;
    });
  }, [createForm.departmentId, users]);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConversationId || !message.trim()) return;

    setError(null);
    const response = await fetch(
      `/api/conversations/${selectedConversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      }
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao enviar mensagem.");
      return;
    }

    setMessage("");
    await Promise.all([
      loadConversation(selectedConversationId),
      refreshConversationList(),
    ]);
  }

  async function handleStatusChange(status: ConversationStatus) {
    if (!selectedConversationId) return;
    setError(null);
    const response = await fetch(`/api/conversations/${selectedConversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao atualizar status.");
      return;
    }

    await Promise.all([
      loadConversation(selectedConversationId),
      refreshConversationList(),
    ]);
  }

  async function handleCreateConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.customerId || !createForm.departmentId) return;

    setCreateLoading(true);
    setError(null);

    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: createForm.customerId,
        departmentId: createForm.departmentId,
        assignedToId: createForm.assignedToId || null,
        channel: createForm.channel,
        initialMessage: createForm.initialMessage || undefined,
      }),
    });
    setCreateLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error ?? "Falha ao abrir atendimento.");
      return;
    }

    const payload = (await response.json()) as { conversation: { id: string } };
    await refreshConversationList();
    setSelectedConversationId(payload.conversation.id);
    setCreateForm((previous) => ({ ...previous, initialMessage: "" }));
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleCreateConversation}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-6"
      >
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Cliente
          </span>
          <select
            value={createForm.customerId}
            onChange={(event) =>
              setCreateForm((previous) => ({
                ...previous,
                customerId: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Setor
          </span>
          <select
            value={createForm.departmentId}
            onChange={(event) =>
              setCreateForm((previous) => ({
                ...previous,
                departmentId: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            disabled={currentUser.role !== "ADMIN"}
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Canal
          </span>
          <select
            value={createForm.channel}
            onChange={(event) =>
              setCreateForm((previous) => ({
                ...previous,
                channel: event.target.value as ConversationChannel,
              }))
            }
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            {CONVERSATION_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {CHANNEL_LABELS[channel]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Responsável
          </span>
          <select
            value={createForm.assignedToId}
            onChange={(event) =>
              setCreateForm((previous) => ({
                ...previous,
                assignedToId: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Sem responsável</option>
            {usersForSelectedDepartment.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={createLoading}
          className="mt-auto rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {createLoading ? "Abrindo..." : "Criar conversa"}
        </button>

        <input
          value={createForm.initialMessage}
          onChange={(event) =>
            setCreateForm((previous) => ({
              ...previous,
              initialMessage: event.target.value,
            }))
          }
          placeholder="Mensagem inicial (opcional)"
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-6"
        />
      </form>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="grid min-h-[660px] gap-4 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por cliente, setor ou texto"
              className="w-full bg-transparent outline-none"
            />
          </div>

          <div className="mb-3 flex gap-2">
            <ChannelFilterTag
              active={channelFilter === "ALL"}
              label="Todos"
              onClick={() => setChannelFilter("ALL")}
            />
            <ChannelFilterTag
              active={channelFilter === "INTERNAL"}
              label="Interno"
              onClick={() => setChannelFilter("INTERNAL")}
            />
            <ChannelFilterTag
              active={channelFilter === "WHATSAPP"}
              label="WhatsApp"
              onClick={() => setChannelFilter("WHATSAPP")}
            />
          </div>

          <div className="space-y-2">
            {filteredConversations.map((conversation) => {
              const isActive = selectedConversationId === conversation.id;
              const preview = conversation.messages[0]?.content ?? "Sem mensagens";
              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isActive
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-semibold text-slate-800">
                      {conversation.customer.name}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        conversation.channel === "WHATSAPP"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {CHANNEL_LABELS[conversation.channel]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs text-slate-500">{preview}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{conversation.department.name}</span>
                    <span>{STATUS_LABELS[conversation.status]}</span>
                  </div>
                </button>
              );
            })}
            {filteredConversations.length === 0 ? (
              <p className="px-2 py-6 text-sm text-slate-500">
                Nenhuma conversa encontrada.
              </p>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!selectedConversationId ? (
            <div className="p-6 text-sm text-slate-500">
              Selecione uma conversa para visualizar.
            </div>
          ) : loadingConversation ? (
            <div className="p-6 text-sm text-slate-500">Carregando conversa...</div>
          ) : selectedConversation ? (
            <>
              <header className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selectedConversation.customer.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedConversation.customer.company ?? "Sem empresa"} •{" "}
                      {selectedConversation.customer.phone}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          selectedConversation.channel === "WHATSAPP"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {CHANNEL_LABELS[selectedConversation.channel]}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                        {selectedConversation.department.name}
                      </span>
                    </div>
                  </div>
                  <select
                    value={selectedConversation.status}
                    onChange={(event) =>
                      handleStatusChange(event.target.value as ConversationStatus)
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">
                {selectedConversation.messages.map((item) => {
                  const isSystem =
                    item.senderType === "SYSTEM" || item.direction === "SYSTEM";
                  const isInbound =
                    item.senderType === "CUSTOMER" || item.direction === "INBOUND";

                  return (
                    <div
                      key={item.id}
                      className={`flex ${isSystem ? "justify-center" : isInbound ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                          isSystem
                            ? "bg-amber-50 text-amber-900"
                            : isInbound
                              ? "bg-white text-slate-900"
                              : "bg-blue-600 text-white"
                        }`}
                      >
                        <p>{item.content}</p>
                        <p
                          className={`mt-1 flex items-center gap-1 text-[11px] ${
                            isInbound || isSystem ? "text-slate-500" : "text-blue-100"
                          }`}
                        >
                          {isSystem ? (
                            <Clock3 className="h-3 w-3" />
                          ) : isInbound ? (
                            <UserRound className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          <span>{item.sender?.name ?? (isInbound ? "Cliente" : "Sistema")}</span>
                          <span>•</span>
                          <span>
                            {formatDistanceToNow(new Date(item.createdAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                          {item.deliveryStatus ? <span>• {item.deliveryStatus}</span> : null}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {selectedConversation.messages.length === 0 ? (
                  <p className="text-sm text-slate-500">Ainda sem mensagens.</p>
                ) : null}
              </div>

              <form
                onSubmit={handleSendMessage}
                className="border-t border-slate-200 bg-white p-4"
              >
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2">
                    <MessageCircle className="h-4 w-4 text-slate-400" />
                    <input
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder={
                        selectedConversation.channel === "WHATSAPP"
                          ? "Digite para responder no WhatsApp..."
                          : "Digite uma resposta..."
                      }
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <MessageCircleMore className="h-4 w-4" />
                    Enviar
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="p-6 text-sm text-slate-500">
              Não foi possível carregar os detalhes da conversa.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ChannelFilterTag({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        active
          ? "bg-blue-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
