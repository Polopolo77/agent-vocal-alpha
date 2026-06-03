// Route serveur (Next.js) : détient ADMIN_API_KEY dans une variable d'env
// SERVEUR (jamais NEXT_PUBLIC, donc jamais exposée au navigateur) et relaie la
// requête vers le backend Argos avec le header X-Admin-Key.
//
// Le navigateur du dashboard appelle /api/conversations (même origine, SANS
// secret) -> cette route ajoute la clé côté serveur -> le backend renvoie les
// transcripts. La clé ne transite jamais par le navigateur.
export const dynamic = "force-dynamic"; // jamais prérendu/caché : données fraîches

const BACKEND_CONVERSATIONS =
  "https://web-production-572b6.up.railway.app/api/conversations";

export async function GET() {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return Response.json(
      { error: "ADMIN_API_KEY manquante dans l'env serveur du dashboard" },
      { status: 500 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(BACKEND_CONVERSATIONS, {
      headers: { "X-Admin-Key": adminKey },
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "backend injoignable" }, { status: 502 });
  }

  if (!upstream.ok) {
    return Response.json(
      { error: `backend a répondu ${upstream.status}` },
      { status: upstream.status },
    );
  }

  const data = await upstream.json();
  return Response.json(data);
}
