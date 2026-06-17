// Route serveur (Next.js) : lit les conversations DIRECTEMENT depuis Supabase
// (où vivent les données), côté serveur. Plus de dépendance au backend Argos
// Concierge.
//
// IMPORTANT : pagination COMPLÈTE. On récupère TOUTES les conversations par
// pages successives, quel que soit leur nombre (Supabase plafonne chaque
// requête à ~1000 lignes — sans pagination, les plus anciennes finiraient
// par disparaître, comme c'est arrivé aux Trinity Sphères au-delà de 200).
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

const PAGE_SIZE = 1000; // taille d'une page Supabase
const MAX_PAGES = 100; // garde-fou (100 000 convs) — jamais une boucle infinie

interface SupabaseRow {
  id: number;
  started_at: string;
  duration_seconds: number | null;
  message_count: number | null;
  product_id: string | null;
  transcript: unknown;
}

const SELECT =
  "id,started_at,duration_seconds,message_count,product_id,transcript";

async function fetchPage(offset: number): Promise<SupabaseRow[]> {
  const url =
    `${SUPABASE_URL}/rest/v1/voice_conversations` +
    `?select=${SELECT}&order=id.desc&limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as SupabaseRow[];
}

export async function GET() {
  const rows: SupabaseRow[] = [];
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const batch = await fetchPage(page * PAGE_SIZE);
      rows.push(...batch);
      // page incomplète => dernière page atteinte, on arrête
      if (batch.length < PAGE_SIZE) break;
    }
  } catch (e) {
    return Response.json(
      { error: "Supabase injoignable", detail: String(e).slice(0, 200) },
      { status: 502 },
    );
  }

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
