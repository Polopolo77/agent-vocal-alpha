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

export interface AgentInfo {
  type: AgentType;
  label: string;
  campaign: string;
}

export function getAgentInfo(conversation: Conversation): AgentInfo {
  if (
    conversation.product_id === "fortune_strategique" ||
    conversation.product_id === "assistant-heritage"
  ) {
    return { type: "heritage", label: "Héritage Éditions", campaign: "Trinity Sphères" };
  }
  if (conversation.product_id === "assistant-argo") {
    return { type: "argo", label: "Argo Éditions", campaign: "Monnaie de l'IA" };
  }
  // Argo multi-produits
  const productLabels: Record<string, string> = {
    actions_gagnantes: "Actions Gagnantes",
    profits_asymetriques: "Profits Asymétriques",
    agent_alpha: "Agent Alpha",
    strategie_haut_rendement: "Stratégie Haut Rendement",
  };
  const campaign = conversation.product_id && productLabels[conversation.product_id]
    ? productLabels[conversation.product_id]
    : "Général";
  return { type: "argo", label: "Argo Éditions", campaign };
}

export function getAgentType(conversation: Conversation): AgentType {
  return getAgentInfo(conversation).type;
}

export function getAgentLabel(type: AgentType): string {
  return type === "heritage" ? "Héritage Éditions" : "Argo Éditions";
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
