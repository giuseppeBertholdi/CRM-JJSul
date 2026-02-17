"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, Search } from "lucide-react";

const TITLES: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Dashboard operacional",
    description: "Acompanhe volume, SLA e distribuição por setor.",
  },
  "/conversations": {
    title: "Inbox omnichannel",
    description: "Atenda conversas internas e WhatsApp em uma única tela.",
  },
  "/customers": {
    title: "Base de clientes",
    description: "Cadastre e mantenha dados do relacionamento.",
  },
  "/automations": {
    title: "Automações",
    description: "Configure lembretes e follow-ups automáticos.",
  },
  "/users": {
    title: "Usuários e acesso",
    description: "Gerencie perfis, papéis e segurança por setor.",
  },
  "/departments": {
    title: "Setores",
    description: "Organize a estrutura interna de atendimento.",
  },
};

export function Topbar() {
  const pathname = usePathname();

  const current = useMemo(() => {
    return (
      TITLES[pathname] ?? {
        title: "CRM JJSul",
        description: "Gestão centralizada de atendimento.",
      }
    );
  }, [pathname]);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full",
      }).format(new Date()),
    []
  );

  return (
    <header className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{current.title}</h1>
          <p className="text-sm text-slate-500">{current.description}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays className="h-4 w-4" />
          <span className="capitalize">{today}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
        <Search className="h-4 w-4" />
        <span>Use a navegação lateral para alternar os módulos.</span>
      </div>
    </header>
  );
}
