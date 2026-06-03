"use client";

import { useState, useEffect, useMemo } from "react";
import { Conversation, AgentType, getAgentType } from "./types";
import { fetchConversations } from "./api";
import { mockConversations } from "./mock-data";

interface UseConversationsOptions {
  filter?: AgentType;
}

export interface BucketStats {
  total: number;
  today: number;
  totalMessages: number;
  avgDuration: number;
}

export interface AllBuckets {
  heritage: BucketStats;
  argo: BucketStats;
  general: BucketStats;
}

function computeStats(items: Conversation[]): BucketStats {
  const today = new Date().toISOString().split("T")[0];
  const todayCount = items.filter(
    (c) => c.started_at.split("T")[0] === today
  ).length;
  const totalMessages = items.reduce((sum, c) => sum + c.message_count, 0);
  const avgDuration =
    items.length > 0
      ? Math.round(
          items.reduce((sum, c) => sum + c.duration_seconds, 0) / items.length
        )
      : 0;
  return {
    total: items.length,
    today: todayCount,
    totalMessages,
    avgDuration,
  };
}

export function useConversations(options?: UseConversationsOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchConversations();
        if (cancelled) return;

        if (data.conversations.length === 0) {
          setConversations(mockConversations);
          setUsingMock(true);
        } else {
          setConversations(data.conversations);
          setUsingMock(false);
        }
        setOnline(true);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch conversations, using mock data:", err);
        setConversations(mockConversations);
        setUsingMock(true);
        setOnline(false);
        setError(err instanceof Error ? err.message : "Erreur réseau");
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

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  const buckets = useMemo<AllBuckets>(() => {
    const heritage = conversations.filter((c) => getAgentType(c) === "heritage");
    const argo = conversations.filter((c) => getAgentType(c) === "argo");
    const general = conversations.filter((c) => getAgentType(c) === "general");
    return {
      heritage: computeStats(heritage),
      argo: computeStats(argo),
      general: computeStats(general),
    };
  }, [conversations]);

  return {
    conversations: filtered,
    allConversations: conversations,
    loading,
    error,
    stats,
    buckets,
    usingMock,
    online,
  };
}
