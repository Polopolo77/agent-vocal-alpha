"use client";

import { Message, AgentType, AGENT_COLORS } from "@/lib/types";

interface TranscriptViewProps {
  messages: Message[];
  agentType: AgentType;
  accentColor?: string;
}

const AGENT_NAMES: Record<AgentType, string> = {
  heritage: "Assistant Héritage",
  argo: "Assistant Argo",
  general: "Assistant Argo",
};

const AGENT_LETTERS: Record<AgentType, string> = {
  heritage: "H",
  argo: "A",
  general: "G",
};

export default function TranscriptView({
  messages,
  agentType,
  accentColor,
}: TranscriptViewProps) {
  const agentName = AGENT_NAMES[agentType];
  const agentColor = accentColor || AGENT_COLORS[agentType];

  // Build subtle bubble background from accent
  const bubbleBg = `${agentColor}0f`;
  const bubbleBorder = `${agentColor}33`;

  // Normaliser : tous les rôles non-user et non-event sont traités comme assistant
  // (assistant, alpha=Argos, model, bot, etc.)
  const chatMessages = messages
    .filter((m) => m.role !== "event" && m.role !== "monitor")
    .map((m) => ({
      ...m,
      _isUser: m.role === "user",
    }));

  return (
    <div className="px-5 py-5 space-y-1 max-h-[600px] overflow-y-auto bg-[#fafbfc]">
      {chatMessages.length === 0 && (
        <div className="text-center text-[#94a3b8] text-sm py-8">
          Pas de messages échangés
        </div>
      )}
      {chatMessages.map((msg, i) => {
        const isUser = msg._isUser;
        const prev = chatMessages[i - 1];
        const showAvatar = i === 0 || !prev || prev._isUser !== isUser;

        return (
          <div
            key={i}
            className={`flex gap-2.5 ${
              isUser ? "flex-row-reverse" : "flex-row"
            } ${showAvatar ? "mt-4" : "mt-0.5"}`}
          >
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
                {isUser ? "V" : AGENT_LETTERS[agentType]}
              </div>
            ) : (
              <div className="w-7 shrink-0" />
            )}

            {/* Bubble */}
            <div className="max-w-[80%]">
              {showAvatar && (
                <div
                  className={`text-[10px] font-semibold mb-1 ${
                    isUser ? "text-right text-[#94a3b8]" : ""
                  }`}
                  style={!isUser ? { color: agentColor } : undefined}
                >
                  {isUser ? "Visiteur" : agentName}
                </div>
              )}
              <div
                className={`px-3.5 py-2.5 text-[13px] leading-[1.6] ${
                  isUser ? "rounded-2xl rounded-tr-md" : "rounded-2xl rounded-tl-md border"
                }`}
                style={
                  isUser
                    ? {
                        backgroundColor: "#f1f5f9",
                        color: "#334155",
                      }
                    : {
                        backgroundColor: bubbleBg,
                        borderColor: bubbleBorder,
                        borderLeft: `3px solid ${agentColor}`,
                        color: "#334155",
                      }
                }
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
