export interface Message {
  // Plusieurs rôles selon l'agent : "assistant" (gemini), "alpha" (Argos), "event" (technique)
  role: "user" | "assistant" | "alpha" | "event" | string;
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

export type AgentType = "heritage" | "megablock" | "argo" | "general";

export interface AgentInfo {
  type: AgentType;
  label: string;
  campaign: string;
  color: string;
}

// Brand colors per agent type
export const AGENT_COLORS: Record<AgentType, string> = {
  heritage: "#d4a44c",
  megablock: "#16A34A",
  argo: "#7c3aed",
  general: "#06b6d4",
};

// Tous les sous-produits Argo appartiennent au projet "Argos Concierge"
export const PRODUCT_LABELS: Record<string, string> = {
  argos_concierge: "Argos Concierge",
  argo_actions: "Argos Concierge",
  argo_alpha: "Argos Concierge",
  argo_gold: "Argos Concierge",
  argo_crypto: "Argos Concierge",
  actions_gagnantes: "Argos Concierge",
  profits_asymetriques: "Argos Concierge",
  agent_alpha: "Argos Concierge",
  strategie_haut_rendement: "Argos Concierge",
};

export function getAgentInfo(conversation: Conversation): AgentInfo {
  const pid = conversation.product_id;

  // Trinity Sphères (Heritage)
  if (pid === "fortune_strategique" || pid === "assistant-heritage") {
    return {
      type: "heritage",
      label: "Héritage Éditions",
      campaign: "Trinity Sphères",
      color: AGENT_COLORS.heritage,
    };
  }

  // Megablock / Stratégie Green Zone (Heritage) — section dédiée
  if (pid === "assistant-megablock") {
    return {
      type: "megablock",
      label: "Héritage Éditions",
      campaign: "Megablock",
      color: AGENT_COLORS.megablock,
    };
  }

  // Monnaie de l'IA (dedicated Argo widget)
  if (pid === "assistant-argo") {
    return {
      type: "argo",
      label: "Argo Éditions",
      campaign: "Monnaie de l'IA",
      color: AGENT_COLORS.argo,
    };
  }

  // Argos Concierge — un seul projet, tous les sous-produits regroupés
  return {
    type: "general",
    label: "Argo Éditions",
    campaign: "Argos Concierge",
    color: AGENT_COLORS.general,
  };
}

export function getAgentType(conversation: Conversation): AgentType {
  return getAgentInfo(conversation).type;
}

export function getAgentLabel(type: AgentType): string {
  if (type === "heritage" || type === "megablock") return "Héritage Éditions";
  if (type === "argo") return "Argo Éditions";
  return "Argos Concierge";
}

export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec} s`;
  return `${min} min ${sec.toString().padStart(2, "0")} s`;
}

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = MONTHS_FR[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year} à ${hours}h${minutes}`;
}

/**
 * Smart date formatting:
 *  - <1h  : "Il y a Xmin"
 *  - <24h : "Il y a Xh"
 *  - same day as today: "Aujourd'hui à HH:MM"
 *  - yesterday: "Hier à HH:MM"
 *  - this week (<7d): "lundi à HH:MM"
 *  - older: absolute date
 */
export function formatDateSmart(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const time = `${hours}h${minutes}`;

  if (diffMs < 0) {
    return formatDateFr(dateStr);
  }

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    if (diffH < 6) return `Il y a ${diffH} h`;
    return `Aujourd'hui à ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  if (isYesterday) return `Hier à ${time}`;

  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 7) {
    const weekdays = [
      "dimanche",
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
    ];
    const weekday = weekdays[date.getDay()];
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} à ${time}`;
  }

  // Older — absolute date without year if current year
  const day = date.getDate();
  const month = MONTHS_FR[date.getMonth()];
  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${month} à ${time}`;
  }
  return `${day} ${month} ${date.getFullYear()}`;
}

export function getFirstUserMessage(conversation: Conversation): string {
  const first = conversation.messages.find((m) => m.role === "user");
  if (!first) return "Aucun message";
  return first.text.length > 120
    ? first.text.slice(0, 120) + "..."
    : first.text;
}
