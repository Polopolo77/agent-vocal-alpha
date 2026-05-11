"use client";

import { useConversations } from "@/lib/useConversations";
import { AgentType } from "@/lib/types";
import DashboardShell from "./DashboardShell";
import StatsCards from "./StatsCards";
import ConversationList from "./ConversationList";

interface DashboardPageProps {
  filter?: AgentType;
  title: string;
  subtitle?: string;
  accentColor?: string;
}

export default function DashboardPage({
  filter,
  title,
  subtitle,
  accentColor,
}: DashboardPageProps) {
  const { conversations, loading, stats } = useConversations({
    filter,
  });

  return (
    <DashboardShell title={title} subtitle={subtitle}>
      <div className="space-y-6">
        <StatsCards {...stats} accentColor={accentColor} />
        <ConversationList conversations={conversations} loading={loading} />
      </div>
    </DashboardShell>
  );
}
