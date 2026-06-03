import { ConversationsResponse } from "./types";

// On NE tape PLUS le backend Railway en direct depuis le navigateur (ça
// exigerait d'exposer la clé admin côté client). On passe par la route serveur
// du dashboard (/api/conversations) qui ajoute le header X-Admin-Key côté
// serveur. Même origine -> URL relative.
const API_URL = "/api/conversations";

export async function fetchConversations(): Promise<ConversationsResponse> {
  const res = await fetch(API_URL, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}
