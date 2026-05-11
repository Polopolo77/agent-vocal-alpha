"use client";

import { useState, useEffect, useMemo } from "react";
import { Conversation, AgentType, getAgentType } from "./types";
import { fetchConversations } from "./api";
import { mockConversations } from "./mock-data";

interface UseConversationsOptions {
  filter?: AgentType;
}

export function useConversations(options?: UseConversationsOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchConversations();
        if (cancelled) return;

        if (data.conversations.length === 0) {
          // Use mock data when API returns empty
          setConversations(mockConversations);
          setUsingMock(true);
        } else {
          setConversations(data.conversations);
          setUsingMock(false);
        }
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch conversations, using mock data:", err);
        setConversations(mockConversations);
        setUsingMock(true);
        setError(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!options?.filter) return conversations;
    return conversations.filter((c) => getAgentType(c) === options.filter);
  }, [conversations, options?.filter]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todayCount = filtered.filter(
      (c) => c.started_at.split("T")[0] === today
    ).length;
    const totalMessages = filtered.reduce(
      (sum, c) => sum + c.message_count,
      0
    );
    const avgDuration =
      filtered.length > 0
        ? Math.round(
            filtered.reduce((sum, c) => sum + c.duration_seconds, 0) /
              filtered.length
          )
        : 0;

    return {
      total: filtered.length,
      today: todayCount,
      totalMessages,
      avgDuration,
    };
  }, [filtered]);

  return {
    conversations: filtered,
    loading,
    error,
    stats,
    usingMock,
  };
}
