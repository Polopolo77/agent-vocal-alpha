"use client";

import { useState } from "react";
import {
  Conversation,
  getAgentType,
  getAgentLabel,
  formatDuration,
  formatDateFr,
  getFirstUserMessage,
} from "@/lib/types";
import TranscriptView from "./TranscriptView";

interface ConversationCardProps {
  conversation: Conversation;
  index: number;
}

export default function ConversationCard({
  conversation,
  index,
}: ConversationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const agentType = getAgentType(conversation);
  const isHeritage = agentType === "heritage";

  const badgeColor = isHeritage
    ? "bg-[rgba(212,164,76,0.1)] text-[#b8860b] border-[rgba(212,164,76,0.3)]"
    : "bg-[rgba(124,58,237,0.08)] text-[#7c3aed] border-[rgba(124,58,237,0.25)]";

  const accentLine = isHeritage ? "bg-[#d4a44c]" : "bg-[#7c3aed]";

  return (
    <div
      className="animate-fade-in"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className={`
          bg-white border border-[#e2e8f0] rounded-xl overflow-hidden
          hover:shadow-md hover:border-[#cbd5e1] cursor-pointer
          ${expanded ? "shadow-md border-[#cbd5e1]" : ""}
        `}
      >
        {/* Card header */}
        <div
          className="flex items-start gap-4 p-4"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Accent line */}
          <div className={`w-0.5 h-12 rounded-full ${accentLine} shrink-0`} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5 flex-wrap">
              <span className="text-sm text-[#1e293b] font-medium">
                {formatDateFr(conversation.started_at)}
              </span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeColor}`}
              >
                {getAgentLabel(agentType)}
              </span>
            </div>

            <p className="text-sm text-[#64748b] leading-relaxed line-clamp-2">
              {getFirstUserMessage(conversation)}
            </p>

            {/* Meta */}
            <div className="flex items-center gap-4 mt-2.5">
              <span className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {formatDuration(conversation.duration_seconds)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#94a3b8]">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                  />
                </svg>
                {conversation.message_count} messages
              </span>
            </div>
          </div>

          {/* Expand icon */}
          <svg
            className={`w-5 h-5 text-[#cbd5e1] shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>

        {/* Expanded transcript */}
        {expanded && (
          <div className="animate-slide-down border-t border-[#e2e8f0]">
            <TranscriptView
              messages={conversation.messages}
              agentType={agentType}
            />
          </div>
        )}
      </div>
    </div>
  );
}
