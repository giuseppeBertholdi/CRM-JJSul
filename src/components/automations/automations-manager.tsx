"use client";

import { FormEvent, useState } from "react";
import { CONVERSATION_STATUSES, STATUS_LABELS } from "@/lib/constants";

type Role = "ATTENDANT" | "MANAGER" | "ADMIN";

type Department = {
  id: string;
  name: string;
};

type AutomationRule = {
  id: string;
  triggerStatus: (typeof CONVERSATION_STATUSES)[number];
  delayHours: number;
  messageTemplate: string;
  isActive: boolean;
  department: Department | null;
  departmentId?: string | null;
  _count: {
    reminderLogs: number;
  };
};

type AutomationsManagerProps = {
  initialRules: AutomationRule[];
  departments: Department[];
  currentUserRole: Role;
  currentUserDepartmentId: string | null;
};

const defaultForm = {
  triggerStatus: "QUOTE_SENT" as (typeof CONVERSATION_STATUSES)[number],
  delayHours: 24,
  messageTemplate:
    "Follow-up: {{cliente}}, confirmamos o recebimento da cotação. Atendimento {{atendimentoId}}.",
  isActive: true,
  departmentId: "",
};

export function AutomationsManager({
  initialRules,
  departments,
  currentUserRole,
  currentUserDepartmentId,
}: AutomationsManagerProps) {
  const [rules, setRules] = useState<AutomationRule[]>(initialRules);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refreshRules() {
    const response = await fetch("/api/automations");
    if (!response.ok) return;
    const payload = (await response.json()) as { automations: AutomationRule[] };
    setRules(payload.automations);
  }

  function startEdit(rule: AutomationRule) {
    setEditingId(rule.id);
    setForm({
      triggerStatus: rule.triggerStatus,
      delayHours: rule.delayHours,
      messageTemplate: rule.messageTemplate,
      isActive: rule.isActive,
      departmentId: rule.department?.id ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(defaultForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      triggerStatus: form.triggerStatus,
      delayHours: Number(form.delayHours),
      messageTemplate: form.messageTemplate,
      isActive: form.isActive,
      departmentId:
        currentUserRole === "ADMIN"
          ? form.departmentId || null
          : currentUserDepartmentId,
    };

    const response = await fetch(
      editingId ? `/api/automations/${editingId}` : "/api/automations",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    setLoading(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "Falha ao salvar regra.");
      return;
    }

    await refreshRules();
    cancelEdit();
  }

  async function deleteRule(ruleId: string) {
    const confirmed = window.confirm("Deseja excluir esta regra?");
    if (!confirmed) return;

    const response = await fetch(`/api/automations/${ruleId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(body?.error ?? "Falha ao excluir regra.");
      return;
    }

    await refreshRules();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
      >
        <select
          value={form.triggerStatus}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              triggerStatus: event.target.value as (typeof CONVERSATION_STATUSES)[number],
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {CONVERSATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          value={form.delayHours}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              delayHours: Number(event.target.value),
            }))
          }
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Atraso em horas"
        />

        {currentUserRole === "ADMIN" ? (
          <select
            value={form.departmentId}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                departmentId: event.target.value,
              }))
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          >
            <option value="">Regra global</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        ) : null}

        <textarea
          value={form.messageTemplate}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              messageTemplate: event.target.value,
            }))
          }
          className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />

        <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                isActive: event.target.checked,
              }))
            }
          />
          Regra ativa
        </label>

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 md:col-span-2">
          <button
            disabled={loading}
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? "Salvando..." : editingId ? "Atualizar regra" : "Criar regra"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Gatilho</th>
              <th className="px-4 py-3 font-medium text-slate-600">Atraso</th>
              <th className="px-4 py-3 font-medium text-slate-600">Setor</th>
              <th className="px-4 py-3 font-medium text-slate-600">Envios</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-800">{STATUS_LABELS[rule.triggerStatus]}</td>
                <td className="px-4 py-3 text-slate-600">{rule.delayHours}h</td>
                <td className="px-4 py-3 text-slate-600">{rule.department?.name ?? "Global"}</td>
                <td className="px-4 py-3 text-slate-600">{rule._count?.reminderLogs ?? 0}</td>
                <td className="px-4 py-3 text-slate-600">
                  {rule.isActive ? "Ativa" : "Inativa"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(rule)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRule(rule.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  Nenhuma regra cadastrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
