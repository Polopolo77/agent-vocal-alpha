"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export default function DashboardShell({
  children,
  title,
  subtitle,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[#e2e8f0]">
          <div className="flex items-center gap-4 px-6 py-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-[#64748b] hover:text-[#1e293b]"
            >
              <svg
                className="w-6 h-6"
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

            <div>
              <h2 className="text-lg font-semibold text-[#1e293b] tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-[#94a3b8] mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="px-6 py-6 max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
