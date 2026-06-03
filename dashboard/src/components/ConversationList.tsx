"use client";

import { useState, useMemo } from "react";
import { Conversation, getAgentInfo } from "@/lib/types";
import ConversationCard from "./ConversationCard";
import SearchBar from "./SearchBar";

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  accentColor?: string;
  /** Empty-state hint, e.g. "Cette campagne n'a pas encore reçu d'appels." */
  emptyHint?: string;
}

export default function ConversationList({
  conversations,
  loading,
  accentColor,
  emptyHint,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);

  // Build list of unique campaigns from the conversations
  const campaigns = useMemo(() => {
    const seen = new Map<string, number>();
    for (const conv of conversations) {
      const info = getAgentInfo(conv);
      seen.set(info.campaign, (seen.get(info.campaign) || 0) + 1);
    }
    return Array.from(seen.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [conversations]);

  const filtered = useMemo(() => {
    let list = conversations;

    if (campaignFilter) {
      list = list.filter(
        (c) => getAgentInfo(c).campaign === campaignFilter
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.messages.some((m) => m.text.toLowerCase().includes(q))
      );
    }

    return list;
  }, [conversations, search, campaignFilter]);

  // Sort by date descending
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      ),
    [filtered]
  );

  const accent = accentColor || "#64748b";

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-[#f1f5f9] rounded-lg animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 bg-[#f1f5f9] rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  const showCampaignChips = campaigns.length > 1;

  return (
    <div className="space-y-4">
      <SearchBar value={search} onChange={setSearch} />

      {showCampaignChips && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCampaignFilter(null)}
            className="text-[11px] font-medium px-3 py-1 rounded-full border transition-colors"
            style={
              campaignFilter === null
                ? {
                    backgroundColor: accent,
                    color: "#fff",
                    borderColor: accent,
                  }
                : {
                    backgroundColor: "#fff",
                    color: "#64748b",
                    borderColor: "#e2e8f0",
                  }
            }
          >
            Toutes
            <span className="ml-1.5 opacity-70 tabular-nums">
              {conversations.length}
            </span>
          </button>
          {campaigns.map((c) => {
            const active = campaignFilter === c.name;
            return (
              <button
                key={c.name}
                onClick={() => setCampaignFilter(active ? null : c.name)}
                className="text-[11px] font-medium px-3 py-1 rounded-full border transition-colors"
                style={
                  active
                    ? {
                        backgroundColor: accent,
                        color: "#fff",
                        borderColor: accent,
                      }
                    : {
                        backgroundColor: "#fff",
                        color: "#64748b",
                        borderColor: "#e2e8f0",
                      }
                }
              >
                {c.name}
                <span className="ml-1.5 opacity-70 tabular-nums">{c.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          accentColor={accent}
          searching={search.length > 0 || campaignFilter !== null}
          hint={emptyHint}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#94a3b8]">
            {sorted.length} conversation{sorted.length > 1 ? "s" : ""}
            {campaignFilter && (
              <>
                {" "}
                · <span className="font-medium">{campaignFilter}</span>
              </>
            )}
          </p>
          {sorted.map((conv, i) => (
            <ConversationCard key={conv.id} conversation={conv} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

interface EmptyStateProps {
  accentColor: string;
  searching: boolean;
  hint?: string;
}

function EmptyState({ accentColor, searching, hint }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4 border border-dashed border-[#e2e8f0] rounded-xl bg-white/50">
      <div
        className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ backgroundColor: `${accentColor}1a` }}
      >
        <svg
          className="w-7 h-7"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke={accentColor}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-[#1e293b]">
        {searching
          ? "Aucun résultat ne correspond"
          : "Aucune conversation pour le moment"}
      </p>
      <p className="text-xs text-[#94a3b8] mt-1.5 max-w-sm mx-auto">
        {searching
          ? "Essayez avec d'autres mots-clés ou retirez les filtres actifs."
          : hint ||
            "Les conversations apparaîtront ici dès que l'agent vocal commencera à recevoir des appels."}
      </p>
    </div>
  );
}
