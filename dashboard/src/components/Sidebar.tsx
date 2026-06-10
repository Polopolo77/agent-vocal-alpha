"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENT_COLORS } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  color?: string;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Tableau de bord",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
  },
  {
    href: "/heritage",
    label: "Trinity Sphères",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
        />
      </svg>
    ),
    color: AGENT_COLORS.heritage,
  },
  {
    href: "/megablock",
    label: "Megablock",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.875 9.75L8.25 12.75h3l-2.625 3"
        />
      </svg>
    ),
    color: AGENT_COLORS.megablock,
  },
  {
    href: "/argo",
    label: "Monnaie de l'IA",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
        />
      </svg>
    ),
    color: AGENT_COLORS.argo,
  },
  {
    href: "/general",
    label: "Argos Concierge",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6h16.5M3.75 12h16.5m-16.5 5.25h16.5"
        />
      </svg>
    ),
    color: AGENT_COLORS.general,
  },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[260px]
          bg-[#f8fafc] border-r border-[#e2e8f0]
          flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-[#e2e8f0]">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, #d4a44c 0%, #7c3aed 60%, #06b6d4 100%)",
              }}
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#1e293b] tracking-tight">
                Agent Vocal
              </h1>
              <p className="text-[11px] text-[#94a3b8]">Tableau de bord</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const accent = item.color;

            const baseClasses = `
              relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-sm
              transition-all duration-150
              ${isActive ? "bg-white shadow-sm" : "hover:bg-white/70"}
            `;

            const activeStyle: React.CSSProperties = isActive && accent
              ? {
                  borderLeft: `3px solid ${accent}`,
                  paddingLeft: "13px",
                  color: accent,
                  background: `${accent}0d`,
                }
              : isActive
                ? {
                    borderLeft: "3px solid #94a3b8",
                    paddingLeft: "13px",
                  }
                : {};

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={baseClasses}
                style={activeStyle}
              >
                <span
                  style={
                    isActive && accent ? { color: accent } : undefined
                  }
                  className={
                    !isActive ? "text-[#64748b]" : ""
                  }
                >
                  {item.icon}
                </span>
                <span
                  className={`font-medium ${
                    isActive ? "" : "text-[#64748b]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section: legend */}
        <div className="px-4 py-4 border-t border-[#e2e8f0] space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-semibold">
            Campagnes
          </p>
          <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: AGENT_COLORS.heritage }}
            />
            <span>Trinity Sphères</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#16A34A" }}
            />
            <span>Megablock</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: AGENT_COLORS.argo }}
            />
            <span>Monnaie de l&apos;IA</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: AGENT_COLORS.general }}
            />
            <span>Argos Concierge</span>
          </div>
        </div>
      </aside>
    </>
  );
}
