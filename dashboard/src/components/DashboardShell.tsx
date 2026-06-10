"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  accentColor?: string;
  totalCount?: number;
  online?: boolean;
}

export default function DashboardShell({
  children,
  title,
  subtitle,
  accentColor,
  totalCount,
  online,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const accent = accentColor || "#94a3b8";

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Global top bar */}
      <div className="shrink-0 h-12 flex items-center justify-between gap-4 px-4 lg:px-6 border-b border-[#e2e8f0] bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-[#64748b] hover:text-[#1e293b]"
            aria-label="Ouvrir le menu"
          >
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
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{
                background:
                  "linear-gradient(135deg, #d4a44c 0%, #7c3aed 60%, #06b6d4 100%)",
              }}
            >
              <svg
                className="w-3.5 h-3.5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#1e293b] tracking-tight">
              Agent Vocal
            </span>
          </div>
        </div>

        {typeof totalCount === "number" && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-[#1e293b] tabular-nums">
              {totalCount}
            </span>
            <span className="text-[#94a3b8]">
              conversation{totalCount > 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span
            className={`relative flex h-2 w-2 ${
              online ? "" : "opacity-50"
            }`}
            aria-hidden="true"
          >
            {online && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                online ? "bg-emerald-500" : "bg-[#cbd5e1]"
              }`}
            />
          </span>
          <span className="text-[11px] font-medium text-[#64748b]">
            {online ? "Live" : "Hors ligne"}
          </span>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 overflow-y-auto">
          {/* Page title bar */}
          <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-[#e2e8f0]">
            <div className="px-6 py-4 max-w-6xl mx-auto">
              <h2
                className="text-lg font-semibold text-[#1e293b] tracking-tight inline-block pb-1.5"
                style={{ borderBottom: `2px solid ${accent}` }}
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-[#94a3b8] mt-1">{subtitle}</p>
              )}
            </div>
          </header>

          {/* Content — centré dans l'espace disponible */}
          <div className="px-6 py-6 max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
