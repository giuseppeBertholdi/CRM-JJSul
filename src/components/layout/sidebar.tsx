"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/common/logout-button";

type SidebarProps = {
  role: "ATTENDANT" | "MANAGER" | "ADMIN";
  departmentName?: string | null;
  userName: string;
};

const baseLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/conversations", label: "Conversas" },
  { href: "/customers", label: "Clientes" },
  { href: "/automations", label: "Automações" },
];

const adminLinks = [
  { href: "/users", label: "Usuários" },
  { href: "/departments", label: "Setores" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Sidebar({ role, departmentName, userName }: SidebarProps) {
  const pathname = usePathname();

  const links = role === "ADMIN" ? [...baseLinks, ...adminLinks] : baseLinks;

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-5">
        <h1 className="text-lg font-semibold text-slate-900">CRM JJSul</h1>
        <p className="mt-1 text-sm text-slate-500">{departmentName ?? "Sem setor"}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cx(
                "block rounded-lg px-3 py-2 text-sm font-medium",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-4 py-4">
        <p className="text-sm font-medium text-slate-700">{userName}</p>
        <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">{role}</p>
        <LogoutButton />
      </div>
    </aside>
  );
}
