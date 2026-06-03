"use client";

import { AGENT_COLORS } from "@/lib/types";
import type { AllBuckets } from "@/lib/useConversations";

interface CampaignBreakdownProps {
  buckets: AllBuckets;
}

export default function CampaignBreakdown({ buckets }: CampaignBreakdownProps) {
  const total =
    buckets.heritage.total + buckets.argo.total + buckets.general.total;

  const rows = [
    {
      key: "heritage",
      label: "Trinity Sphères",
      sub: "Héritage Éditions",
      color: AGENT_COLORS.heritage,
      count: buckets.heritage.total,
    },
    {
      key: "argo",
      label: "Monnaie de l'IA",
      sub: "Argo Éditions",
      color: AGENT_COLORS.argo,
      count: buckets.argo.total,
    },
    {
      key: "general",
      label: "Argos Concierge",
      sub: "Argo Éditions",
      color: AGENT_COLORS.general,
      count: buckets.general.total,
    },
  ];

  const pct = (n: number) =>
    total === 0 ? 0 : Math.round((n / total) * 1000) / 10;

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#1e293b]">
          Répartition par campagne
        </h3>
        <span className="text-xs text-[#94a3b8]">
          {total} conversation{total > 1 ? "s" : ""} au total
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#f1f5f9] mb-4">
        {rows.map((row) => {
          const width = total === 0 ? 0 : (row.count / total) * 100;
          if (width === 0) return null;
          return (
            <div
              key={row.key}
              className="h-full transition-all duration-300"
              style={{
                width: `${width}%`,
                background: row.color,
              }}
              title={`${row.label} — ${row.count} (${pct(row.count)}%)`}
            />
          );
        })}
      </div>

      {/* Legend rows */}
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: row.color }}
              />
              <span className="font-medium text-[#1e293b] truncate">
                {row.label}
              </span>
              <span className="text-[#94a3b8] truncate">{row.sub}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[#64748b] font-medium tabular-nums">
                {row.count}
              </span>
              <span className="text-[#94a3b8] tabular-nums w-12 text-right">
                {pct(row.count)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
