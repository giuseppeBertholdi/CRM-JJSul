"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  LayoutDashboard,
  MessageCircleMore,
  Settings2,
  Users,
  UserSquare2,
} from "lucide-react";
import { LogoutButton } from "@/components/common/logout-button";

type SidebarProps = {
  role: "ATTENDANT" | "MANAGER" | "ADMIN";
  departmentName?: string | null;
  userName: string;
};

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/conversations", label: "Inbox", icon: MessageCircleMore },
  { href: "/customers", label: "Clientes", icon: Building2 },
  { href: "/automations", label: "Automações", icon: Bot },
];

const adminLinks = [
  { href: "/users", label: "Usuários", icon: Users },
  { href: "/departments", label: "Setores", icon: UserSquare2 },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Sidebar({ role, departmentName, userName }: SidebarProps) {
  const pathname = usePathname();

  const links = role === "ADMIN" ? [...baseLinks, ...adminLinks] : baseLinks;

  return (
    <aside className="sticky top-0 flex h-screen w-72 flex-col border-r border-slate-200 bg-white/90 backdrop-blur">
      <div className="border-b border-slate-200 bg-gradient-to-br from-blue-700 to-indigo-700 px-6 py-6 text-white">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-100">Plataforma</p>
        <h1 className="mt-1 text-xl font-semibold">CRM JJSul</h1>
        <p className="mt-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs">
          {departmentName ?? "Sem setor"}
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cx(
                "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-blue-50 text-blue-700 shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700">{userName}</p>
            <p className="text-xs uppercase tracking-wide text-slate-400">{role}</p>
          </div>
          <Settings2 className="ml-auto h-4 w-4 text-slate-400" />
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
