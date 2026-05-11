import { ConversationsResponse } from "./types";

const API_URL =
  "https://web-production-572b6.up.railway.app/api/conversations";

export async function fetchConversations(): Promise<ConversationsResponse> {
  const res = await fetch(API_URL, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
