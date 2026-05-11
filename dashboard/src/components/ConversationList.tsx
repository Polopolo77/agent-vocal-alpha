"use client";

import { useState, useMemo } from "react";
import { Conversation } from "@/lib/types";
import ConversationCard from "./ConversationCard";
import SearchBar from "./SearchBar";

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
}

export default function ConversationList({
  conversations,
  loading,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) =>
      c.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  }, [conversations, search]);

  // Sort by date descending
  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      ),
    [filtered]
  );

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

  return (
    <div className="space-y-4">
      <SearchBar value={search} onChange={setSearch} />

      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <svg
            className="w-12 h-12 text-[#cbd5e1] mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
            />
          </svg>
          <p className="text-[#94a3b8] text-sm">Aucune conversation trouvee</p>
          {search && (
            <p className="text-[#cbd5e1] text-xs mt-1">
              Essayez avec d&apos;autres termes de recherche
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#94a3b8]">
            {sorted.length} conversation{sorted.length > 1 ? "s" : ""}
          </p>
          {sorted.map((conv, i) => (
            <ConversationCard key={conv.id} conversation={conv} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
