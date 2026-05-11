export interface Message {
  role: "user" | "assistant";
  text: string;
}

export interface Conversation {
  id: number;
  started_at: string;
  duration_seconds: number;
  message_count: number;
  product_id: string | null;
  messages: Message[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
}

export type AgentType = "heritage" | "argo";

export function getAgentType(conversation: Conversation): AgentType {
  if (
    conversation.product_id === "fortune_strategique" ||
    conversation.product_id === "assistant-heritage"
  ) {
    return "heritage";
  }
  if (
    conversation.product_id === "assistant-argo"
  ) {
    return "argo";
  }
  return "argo";
}

export function getAgentLabel(type: AgentType): string {
  return type === "heritage" ? "Heritage Editions" : "Argo Editions";
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec} s`;
  return `${min} min ${sec.toString().padStart(2, "0")} s`;
}

export function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    "janvier",
    "fevrier",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "aout",
    "septembre",
    "octobre",
    "novembre",
    "decembre",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year} a ${hours}h${minutes}`;
}

export function getFirstUserMessage(conversation: Conversation): string {
  const first = conversation.messages.find((m) => m.role === "user");
  if (!first) return "Aucun message";
  return first.text.length > 120
    ? first.text.slice(0, 120) + "..."
    : first.text;
}
