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
  const agentName = isHeritage ? "Assistant Héritage" : "Assistant Argo";
  const agentColor = isHeritage ? "#d4a44c" : "#7c3aed";
  const agentBgLight = isHeritage ? "bg-amber-50" : "bg-violet-50";
  const agentTextColor = isHeritage ? "text-amber-700" : "text-violet-700";
  const agentBorderColor = isHeritage ? "border-amber-200" : "border-violet-200";

  return (
    <div className="px-5 py-5 space-y-1 max-h-[600px] overflow-y-auto bg-[#fafbfc]">
      {messages.map((msg, i) => {
        const isUser = msg.role === "user";
        const showAvatar = i === 0 || messages[i - 1]?.role !== msg.role;

        return (
          <div key={i} className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"} ${showAvatar ? "mt-4" : "mt-0.5"}`}>
            {/* Avatar */}
            {showAvatar ? (
              <div
                className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold ${
                  isUser
                    ? "bg-[#e2e8f0] text-[#64748b]"
                    : "text-white"
                }`}
                style={!isUser ? { background: agentColor } : undefined}
              >
                {isUser ? "V" : isHeritage ? "H" : "A"}
              </div>
            ) : (
              <div className="w-7 shrink-0" />
            )}

            {/* Bubble */}
            <div className="max-w-[80%]">
              {showAvatar && (
                <div className={`text-[10px] font-semibold mb-1 ${isUser ? "text-right text-[#94a3b8]" : agentTextColor}`}>
                  {isUser ? "Visiteur" : agentName}
                </div>
              )}
              <div
                className={`
                  px-3.5 py-2.5 text-[13px] leading-[1.6]
                  ${isUser
                    ? "bg-[#f1f5f9] text-[#334155] rounded-2xl rounded-tr-md"
                    : `${agentBgLight} ${agentTextColor} border ${agentBorderColor} rounded-2xl rounded-tl-md`
                  }
                `}
              >
                {msg.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
