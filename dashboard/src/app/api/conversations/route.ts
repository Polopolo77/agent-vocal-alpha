// Route serveur (Next.js) : lit les conversations DIRECTEMENT depuis Supabase
// (où vivent les données), côté serveur. Plus de dépendance au backend Argos
// Concierge — et plus de limite à 200 qui coupait les plus anciennes
// conversations (Trinity Sphères, IDs 1-61).
//
// La clé Supabase reste côté serveur (jamais NEXT_PUBLIC), jamais exposée au
// navigateur. Surchargeable via env si la base change.
export const dynamic = "force-dynamic"; // jamais prérendu/caché : données fraîches

const SUPABASE_URL = (
  process.env.SUPABASE_URL || "https://nenpyfzsxrbjztsjbbnf.supabase.co"
).replace(/\/$/, "");
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lbnB5ZnpzeHJianp0c2piYm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTM5NjQsImV4cCI6MjA5MjQyOTk2NH0.c1OQitjA9dS2tFALVxNWy1FeBSKxdpv61JTrlQW5cHM";

interface SupabaseRow {
  id: number;
  started_at: string;
  duration_seconds: number | null;
  message_count: number | null;
  product_id: string | null;
  transcript: unknown;
}

export async function GET() {
  // ?order=id.desc&limit=2000 : on récupère TOUTES les conversations (les plus
  // récentes d'abord). 2000 couvre largement (et Supabase plafonne de toute
  // façon le nombre de lignes par requête).
  const url =
    `${SUPABASE_URL}/rest/v1/voice_conversations` +
    `?select=id,started_at,duration_seconds,message_count,product_id,transcript` +
    `&order=id.desc&limit=2000`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "Supabase injoignable" }, { status: 502 });
  }

  if (!upstream.ok) {
    const body = await upstream.text();
    return Response.json(
      { error: `Supabase a répondu ${upstream.status}`, detail: body.slice(0, 200) },
      { status: upstream.status },
    );
  }

  const rows = (await upstream.json()) as SupabaseRow[];

  const conversations = rows.map((row) => {
    let messages: unknown = row.transcript;
    if (typeof messages === "string") {
      try {
        messages = JSON.parse(messages);
      } catch {
        messages = [];
      }
    }
    if (!Array.isArray(messages)) messages = [];
    return {
      id: row.id,
      started_at: row.started_at,
      duration_seconds: row.duration_seconds ?? 0,
      message_count: row.message_count ?? 0,
      product_id: row.product_id,
      messages,
    };
  });

  return Response.json({ conversations });
}
