"use client";

import { Message, AgentType } from "@/lib/types";

interface TranscriptViewProps {
  messages: Message[];
  agentType: AgentType;
}

export default function TranscriptView({
  messages,
  agentType,
}: TranscriptViewProps) {
  const isHeritage = agentType === "heritage";
  const assistantAccent = isHeritage
    ? "border-l-[#d4a44c]"
    : "border-l-[#7c3aed]";
  const assistantLabel = isHeritage
    ? "text-[#b8860b]"
    : "text-[#7c3aed]";

  return (
    <div className="px-4 py-4 space-y-3 max-h-[500px] overflow-y-auto bg-[#f8fafc]">
      {messages.map((msg, i) => {
        const isUser = msg.role === "user";

        return (
          <div
            key={i}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`
                max-w-[85%] rounded-2xl px-4 py-3
                ${
                  isUser
                    ? "bg-[#e2e8f0] text-[#1e293b] rounded-br-md"
                    : `bg-white border border-[#e2e8f0] border-l-2 ${assistantAccent} text-[#475569] rounded-bl-md shadow-sm`
                }
              `}
            >
              <div
                className={`text-[10px] font-medium mb-1.5 ${isUser ? "text-[#64748b]" : assistantLabel}`}
              >
                {isUser ? "Visiteur" : "Agent"}
              </div>
              <p className="text-sm leading-relaxed">{msg.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
