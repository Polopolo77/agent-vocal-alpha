#!/usr/bin/env python3
"""Simulateur de conversation Argos — rejoue un appel SANS la voix.

Appelle les vrais endpoints HTTP que le frontend orchestre (coach / dossier /
cards / briefing) tour par tour, et affiche ce que chaque agent renvoie. Sert à
vérifier en boucle : les cartes sortent-elles ? cohérentes/ancrées ? le prix
est-il stable au bon tier ? les phases progressent-elles ?

Ce que ça NE teste pas : l'audio voix (Gemini Live) — ça demande un vrai micro.
Mais ça couvre tout le pipeline agents qui pilote la voix (= là où étaient les bugs).

Usage : lancer le serveur (python3 server.py), puis : python3 tests/sim_conversation.py
"""
import json
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000"


def post(path, payload, timeout=25):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"_http_error": e.code, "_body": e.read().decode("utf-8", "ignore")[:200]}
    except Exception as e:
        return {"_error": f"{type(e).__name__}: {str(e)[:150]}"}


# Profil = celui que Paul a testé : 100k€, tech/IA -> doit router argo_alpha, tier B (997€)
SCRIPT = [
    ("alpha", "Bonjour, ici Argos, le concierge IA d'Argo Editions. Puis-je vous demander votre prenom ?"),
    ("user",  "Je m'appelle Paul."),
    ("alpha", "Merci Paul. Vous investissez deja - bourse, crypto - ou c'est nouveau pour vous ?"),
    ("user",  "J'ai deja investi en bourse, j'ai a peu pres 100 000 euros en ETF."),
    ("alpha", "100 000 euros en ETF, belle base. Vous cherchez a les faire grossir ou a les proteger ?"),
    ("user",  "Plutot faire grossir."),
    ("alpha", "Et votre horizon de placement ?"),
    ("user",  "10 a 20 ans."),
    ("alpha", "Un secteur qui vous attire en particulier ?"),
    ("user",  "La tech, l'intelligence artificielle en ce moment."),
    ("alpha", "Justement Paul, Whitney Tilson, ancien de Wall Street forme par Warren Buffett, supervise un agent IA qui denichе des positions de croissance. Ca vous interesse ?"),
    ("user",  "Oui, dis-moi."),
    ("alpha", "L'agent IA Alpha scanne des milliers d'actions, selectionne 20 positions du Russell 1000, reequilibrage trimestriel, et Whitney Tilson valide la selection."),
    ("user",  "D'accord, et ca coute combien ?"),
    ("alpha", "Il repere les pepites tech sous-evaluees avant qu'elles explosent, comme l'a fait Tilson par le passe."),
    ("user",  "Ok je suis interesse, donnez-moi le prix."),
]


def main():
    sess = post("/api/session", {})
    session_id = sess.get("session_id")
    if not session_id:
        print("Pas de session_id (serveur lancé ?):", sess)
        sys.exit(1)
    print("session:", session_id, "\n" + "=" * 90)

    log = []
    active_product = None
    last_dossier = {}
    cards_seen = 0
    cards_with_image = 0

    for role, text in SCRIPT:
        log.append({"role": role, "text": text})
        turn_user = sum(1 for m in log if m["role"] == "user")

        coach = post("/api/strategist", {"history": log, "turn_number": turn_user,
                                         "mode": "mid_call", "session_id": session_id, "agent_name": "Argos"})
        prod = (coach.get("produit") or {}) if isinstance(coach, dict) else {}
        if prod.get("recommande") and prod.get("certitude") in ("moyen", "ferme"):
            active_product = prod["recommande"]

        dossier = post("/api/ui-dossier", {"history": log, "previous_dossier": last_dossier})
        if isinstance(dossier, dict) and dossier.get("prenom") is not None and "_error" not in dossier:
            last_dossier = dossier

        cards = post("/api/ui-cards", {"history": log, "active_product": active_product,
                                       "session_id": session_id, "dossier": last_dossier})
        card = cards.get("card") if isinstance(cards, dict) else None

        brief = post("/api/briefing", {"session_id": session_id,
                                       "query": "quel est le prix exact et l'opportunite du moment",
                                       "capital": last_dossier.get("capital")})
        price = (brief.get("price_to_announce") or {}) if isinstance(brief, dict) else {}
        phase = ((brief.get("PHASE_LOCK") or {}).get("phase_agent_autorisee")) if isinstance(brief, dict) else None
        allowed = len(brief.get("allowed_numbers", [])) if isinstance(brief, dict) else 0

        if card:
            cards_seen += 1
            if card.get("image_key"):
                cards_with_image += 1

        print(f"\n[T{turn_user} {role.upper()}] {text[:62]}")
        ch = (coach.get('etat_emotionnel') or {}).get('chaleur') if isinstance(coach, dict) else '?'
        print(f"   coach   : chaleur={ch} produit={prod.get('recommande')} tier={prod.get('tier_recommande')} certitude={prod.get('certitude')}")
        if card:
            print(f"   CARTE   : {card.get('template')} | img={card.get('image_key')} | {card.get('title')!r}")
            print(f"             reason: {cards.get('reasoning','')[:80]}")
        else:
            reason = cards.get('reason') or cards.get('_error') or cards.get('_http_error') or 'null'
            print(f"   CARTE   : aucune ({reason})")
        print(f"   dossier : capital={last_dossier.get('capital')!r}  active_product={active_product}")
        print(f"   briefing: phase={phase} | prix={price.get('montant_euros')}EUR tier={price.get('tier_effectif')} | allowed_numbers={allowed}")

    print("\n" + "=" * 90)
    print(f"BILAN : {cards_seen} cartes proposées dont {cards_with_image} avec image. "
          f"Produit final={active_product}. Capital lu={last_dossier.get('capital')!r}.")


if __name__ == "__main__":
    main()
