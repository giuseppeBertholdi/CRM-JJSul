"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_LABELS } from "@/lib/constants";

type Role = "ATTENDANT" | "MANAGER" | "ADMIN";
type ConversationStatus = "OPEN" | "WAITING" | "CLOSED" | "QUOTE_SENT";

type ConversationListItem = {
  id: string;
  status: ConversationStatus;
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
    senderType: "USER" | "SYSTEM";
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    customerId: customers[0]?.id ?? "",
    departmentId: departments[0]?.id ?? "",
    assignedToId: users[0]?.id ?? "",
    initialMessage: "",
  });

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
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
      >
        <select
          value={createForm.customerId}
          onChange={(event) =>
            setCreateForm((previous) => ({
              ...previous,
              customerId: event.target.value,
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>

        <select
          value={createForm.departmentId}
          onChange={(event) =>
            setCreateForm((previous) => ({
              ...previous,
              departmentId: event.target.value,
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          disabled={currentUser.role !== "ADMIN"}
        >
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>

        <select
          value={createForm.assignedToId}
          onChange={(event) =>
            setCreateForm((previous) => ({
              ...previous,
              assignedToId: event.target.value,
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Sem responsável</option>
          {usersForSelectedDepartment.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={createLoading}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {createLoading ? "Abrindo..." : "Novo atendimento"}
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
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-4"
        />
      </form>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="grid min-h-[600px] gap-4 lg:grid-cols-[360px_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Conversas
          </h2>
          <div className="space-y-2">
            {conversations.map((conversation) => {
              const isActive = selectedConversationId === conversation.id;
              const preview = conversation.messages[0]?.content ?? "Sem mensagens";
              return (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full rounded-lg border px-3 py-3 text-left ${
                    isActive
                      ? "border-blue-200 bg-blue-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {conversation.customer.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{preview}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{conversation.department.name}</span>
                    <span>{STATUS_LABELS[conversation.status]}</span>
                  </div>
                </button>
              );
            })}
            {conversations.length === 0 ? (
              <p className="px-2 py-4 text-sm text-slate-500">Nenhuma conversa encontrada.</p>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  </div>
                  <select
                    value={selectedConversation.status}
                    onChange={(event) =>
                      handleStatusChange(event.target.value as ConversationStatus)
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </div>
              </header>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {selectedConversation.messages.map((item) => (
                  <div
                    key={item.id}
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      item.senderType === "SYSTEM"
                        ? "bg-amber-50 text-amber-900"
                        : "bg-slate-100 text-slate-900"
                    }`}
                  >
                    <p>{item.content}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {item.sender?.name ?? "Sistema"} •{" "}
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                ))}
                {selectedConversation.messages.length === 0 ? (
                  <p className="text-sm text-slate-500">Ainda sem mensagens.</p>
                ) : null}
              </div>

              <form
                onSubmit={handleSendMessage}
                className="border-t border-slate-200 p-4"
              >
                <div className="flex gap-2">
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Digite uma resposta..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
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
