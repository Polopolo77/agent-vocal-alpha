"use client";

import { useConversations } from "@/lib/useConversations";
import { AgentType } from "@/lib/types";
import DashboardShell from "./DashboardShell";
import StatsCards from "./StatsCards";
import ConversationList from "./ConversationList";
import CampaignBreakdown from "./CampaignBreakdown";

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
  const { conversations, loading, stats, online, allConversations } =
    useConversations({ filter });

  const isOverview = !filter;

  return (
    <DashboardShell
      title={title}
      subtitle={subtitle}
      accentColor={accentColor}
      totalCount={allConversations.length}
      online={online}
    >
      <div className="space-y-6">
        <StatsCards {...stats} accentColor={accentColor} />

        {isOverview && <CampaignBreakdown conversations={allConversations} />}

        <ConversationList
          conversations={conversations}
          loading={loading}
          accentColor={accentColor}
        />
      </div>
    </DashboardShell>
  );
}
