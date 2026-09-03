"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

import { getTenantExperience } from "@/lib/tenants/catalog";

import { SignOutButton } from "./sign-out-button";

type AppShellProps = {
  children: ReactNode;
  organizationName: string;
  organizationSlug: string;
  userEmail: string;
  isPlatformAdmin?: boolean;
};

type NavigationItem = {
  href: string;
  label: string;
  disabled?: boolean;
};

function getInitials(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "IA";
  }

  return normalizedValue
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getNavigationItems(organizationSlug: string): NavigationItem[] {
  const experience = getTenantExperience(organizationSlug);

  if (experience.modules.includes("commercial")) {
    return [
      { href: "/dashboard", label: "Visão geral" },
      { href: "/dashboard/comercial", label: "Comercial & Inteligência" },
    ];
  }

  return [
    { href: "/dashboard", label: "Visão geral" },
    { href: "/dashboard/projetos", label: "Projetos", disabled: true },
    { href: "/dashboard/contatos", label: "Contatos e CRM", disabled: true },
    { href: "/dashboard/agenda", label: "Agenda", disabled: true },
    { href: "/dashboard/financeiro", label: "Financeiro", disabled: true },
    { href: "/dashboard/documentos", label: "Documentos", disabled: true },
    { href: "/dashboard/inteligencia", label: "Inteligência", disabled: true },
  ];
}

export function AppShell({
  children,
  organizationName,
  organizationSlug,
  userEmail,
  isPlatformAdmin = false,
}: AppShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const organizationInitials = getInitials(organizationName);
  const userInitials = getInitials(userEmail.split("@")[0]);
  const experience = getTenantExperience(organizationSlug);
  const navigationItems = getNavigationItems(organizationSlug);
  const normalizedSlug = organizationSlug.toLowerCase();
  const showControlCenter =
    isPlatformAdmin ||
    normalizedSlug === "allamo" ||
    normalizedSlug === "instituto-allamo" ||
    normalizedSlug === "instituto-allamo-platform";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {isMobileMenuOpen ? (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-200",
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
            {organizationInitials}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-950">
              {organizationName}
            </p>
            <p className="truncate text-xs text-slate-500">
              {experience.productLabel}
            </p>
          </div>

          <button
            aria-label="Fechar menu"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            type="button"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Principal
          </p>

          <div className="space-y-1">
            {navigationItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

              if (item.disabled) {
                return (
                  <div
                    className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400"
                    key={item.href}
                  >
                    <span>{item.label}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Em breve
                    </span>
                  </div>
                );
              }

              return (
                <Link
                  className={[
                    "block rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  ].join(" ")}
                  href={item.href}
                  key={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <p className="mb-3 mt-8 px-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Gestão
          </p>

          <div className="space-y-1">
            {showControlCenter ? (
              <Link
                className={[
                  "block rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                  pathname.startsWith("/dashboard/control-center")
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                ].join(" ")}
                href="/dashboard/control-center"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Államo Control Center
              </Link>
            ) : null}

            <Link
              className={[
                "block rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                pathname.startsWith("/dashboard/acessos")
                  ? "bg-slate-950 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
              ].join(" ")}
              href="/dashboard/acessos"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Usuários e acessos
            </Link>

            <div className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400">
              <span>Configurações</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Em breve
              </span>
            </div>
          </div>
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
              {userInitials}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-950">
                Usuário autenticado
              </p>
              <p className="truncate text-xs text-slate-500">{userEmail}</p>
            </div>
          </div>

          <SignOutButton />
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-20 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            aria-label="Abrir menu"
            className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-xl text-slate-700 hover:bg-slate-50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
            type="button"
          >
            ☰
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
              Organização ativa
            </p>
            <p className="truncate text-sm font-bold text-slate-950">
              {organizationName}
            </p>
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <span className="hidden text-xs font-semibold text-slate-400 lg:block">
              {experience.segmentLabel}
            </span>
            <button
              aria-label="Notificações"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              type="button"
            >
              N
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
              {userInitials}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          Tecnologia Államo · ambiente de desenvolvimento
        </footer>
      </div>
    </div>
  );
}
