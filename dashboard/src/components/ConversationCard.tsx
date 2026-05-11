"use client";

import { useState } from "react";
import {
  Conversation,
  getAgentInfo,
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
  const info = getAgentInfo(conversation);
  const isHeritage = info.type === "heritage";

  const accentColor = isHeritage ? "#d4a44c" : "#7c3aed";
  const badgeBg = isHeritage
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-violet-50 text-violet-700 border-violet-200";
  const campaignBg = isHeritage
    ? "bg-amber-100/60 text-amber-800"
    : "bg-violet-100/60 text-violet-800";

  return (
    <div
      className="animate-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div
        className={`
          bg-white rounded-xl overflow-hidden transition-all duration-200
          border border-[#e2e8f0]
          hover:shadow-lg hover:border-[#cbd5e1]
          ${expanded ? "shadow-lg border-[#cbd5e1] ring-1 ring-[#e2e8f0]" : "shadow-sm"}
        `}
      >
        {/* Card header */}
        <div
          className="flex items-stretch gap-0 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {/* Left accent bar */}
          <div
            className="w-1 shrink-0 rounded-l-xl"
            style={{ background: accentColor }}
          />

          <div className="flex-1 p-4 flex items-start gap-4">
            {/* Avatar / icon */}
            <div
              className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-bold"
              style={{ background: `linear-gradient(135deg, ${accentColor}, ${isHeritage ? '#b8860b' : '#5b21b6'})` }}
            >
              {isHeritage ? "H" : "A"}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badgeBg}`}>
                  {info.label}
                </span>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${campaignBg}`}>
                  {info.campaign}
                </span>
              </div>

              <p className="text-[13px] text-[#334155] leading-relaxed line-clamp-2 mt-1">
                {getFirstUserMessage(conversation)}
              </p>

              {/* Meta row */}
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs text-[#94a3b8] font-medium">
                  {formatDateFr(conversation.started_at)}
                </span>
                <span className="flex items-center gap-1 text-xs text-[#94a3b8]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDuration(conversation.duration_seconds)}
                </span>
                <span className="flex items-center gap-1 text-xs text-[#94a3b8]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  {conversation.message_count}
                </span>
              </div>
            </div>

            {/* Expand chevron */}
            <svg
              className={`w-5 h-5 text-[#cbd5e1] shrink-0 transition-transform duration-200 mt-1 ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>

        {/* Expanded transcript */}
        {expanded && (
          <div className="animate-slide-down border-t border-[#e2e8f0]">
            <TranscriptView messages={conversation.messages} agentType={info.type} />
          </div>
        )}
      </div>
    </div>
  );
}
