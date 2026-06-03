#!/usr/bin/env python3
"""Banc d'essai multi-profils Argos — rejoue plusieurs appels SANS la voix.

Pour chaque profil : appelle les vrais endpoints (coach/dossier/cards/briefing)
tour par tour, puis VÉRIFIE l'orchestration :
  - le bon produit est-il routé ?
  - le bon tier (>50k€ -> B, sinon A) ?
  - les cartes appartiennent-elles au produit actif (pas de fuite cross-produit) ?
  - la whitelist de chiffres est-elle alimentée ?
  - le sceptique n'est-il PAS forcé en closing ?

Ne teste pas l'audio voix (Gemini Live) — ça demande un vrai micro. Mais couvre
tout le pipeline agents qui pilote la voix.

Usage : lancer le serveur (python3 server.py), puis : python3 tests/sim_conversation.py
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:8000"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def post(path, payload, timeout=30):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"_http_error": e.code}
    except Exception as e:
        return {"_error": f"{type(e).__name__}: {str(e)[:120]}"}


# usage_card -> produit propriétaire (pour détecter les fuites cross-produit)
def _load_owners():
    owners = {}
    base = os.path.join(ROOT, "products")
    for pid in ("argo_actions", "argo_crypto", "argo_alpha", "argo_gold"):
        try:
            imgs = json.load(open(os.path.join(base, pid, "images.json")))["images"]
            for im in imgs:
                k = im.get("usage_card")
                if k:
                    owners.setdefault(k, set()).add(pid)  # une clé peut appartenir à PLUSIEURS produits (ex: authority_tilson)
        except Exception:
            pass
    return owners


OWNERS = _load_owners()
GENERIC = {"guarantee_generic", "offer_card"}

PROFILES = [
    {
        "name": "Débutant prudent petit capital",
        "expect_product": "argo_actions", "expect_tier": "A",
        "script": [
            ("alpha", "Bonjour, ici Argos. Puis-je avoir votre prénom ?"),
            ("user",  "Bonjour, moi c'est Marc. Je m'y connais pas trop."),
            ("alpha", "Pas de souci Marc, je vous guide. Vous avez déjà investi ?"),
            ("user",  "Non jamais. J'ai un petit héritage de 8 000 euros, j'ai peur de me faire avoir."),
            ("alpha", "Cette prudence est saine. Vous voulez surtout débuter doucement, sans gros risque ?"),
            ("user",  "Oui, apprendre et pas perdre. Du sérieux pour débuter."),
            ("alpha", "On a une publication d'entrée idéale : Actions Gagnantes, par Whitney Tilson, du value investing solide."),
            ("user",  "Ah, et ça coûte combien ?"),
        ],
    },
    {
        "name": "Crypto curieux petit budget",
        "expect_product": "argo_crypto", "expect_tier": "A",
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Léo. Je veux investir dans la crypto et l'IA."),
            ("alpha", "Vous avez déjà investi en crypto ?"),
            ("user",  "Un peu, genre 5 000 euros. Je cherche des gains rapides, des trucs asymétriques."),
            ("alpha", "L'asymétrie, c'est l'angle. Quel horizon ?"),
            ("user",  "Court terme, je veux du x10 sur des cryptos prometteuses."),
            ("alpha", "On a Eric Wade, spécialiste crypto et tech asymétrique, des Profits Asymétriques."),
            ("user",  "Ah ouais ! Et le prix c'est combien ?"),
        ],
    },
    {
        "name": "Retraité aisé or/minières",
        "expect_product": "argo_gold", "expect_tier": "B",
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Bernard. Je suis à la retraite et je m'inquiète pour l'économie."),
            ("alpha", "Vous avez combien de côté et quel est votre souci ?"),
            ("user",  "Environ 250 000 euros. Je veux profiter de la hausse de l'or et des minières."),
            ("alpha", "L'or, les minières, un cycle rare. Vous visez le haut rendement ?"),
            ("user",  "Oui, du haut rendement sur l'or, les minières, l'uranium."),
            ("alpha", "On a Dan Ferris, le Crocodile de Wall Street, sur l'or et les minières."),
            ("user",  "Intéressant, dis-moi le prix."),
        ],
    },
    {
        # Bug réel (capture Paul) : la carte affichait 997€ mais la voix a annoncé
        # 1997€. 50 000€ PILE n'est PAS > 50 000 -> tier A -> 997€. Carte ET voix
        # doivent dire le MÊME montant : 997€. (Vérifie la source unique de prix.)
        "name": "Frontière 50k or (carte == voix == 997€)",
        "expect_product": "argo_gold", "expect_tier": "A", "expect_price": 997,
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Paul. Je veux me positionner sur l'or avec Dan Ferris."),
            ("alpha", "L'or, les minières, un cycle rare. Vous avez combien à placer ?"),
            ("user",  "J'ai exactement 50 000 euros à investir."),
            ("alpha", "50 000 €, très bien. Vous visez le haut rendement sur l'or et les minières ?"),
            ("user",  "Oui, le haut rendement sur l'or, les minières, l'uranium."),
            ("alpha", "On a Dan Ferris, le Crocodile de Wall Street, sur l'or et les minières."),
            ("user",  "Parfait. C'est combien le prix ?"),
        ],
    },
    {
        "name": "Protection épargne aisé (sécurité)",
        "expect_product": "argo_actions", "expect_tier": "B",
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Henri. J'ai peur pour mon épargne avec l'inflation et la dette française."),
            ("alpha", "Vous cherchez à protéger votre épargne ?"),
            ("user",  "Oui, sécuriser. J'ai 120 000 euros qui dorment sur un livret."),
            ("alpha", "120 000 € qui perdent face à l'inflation. Les mettre à l'abri ?"),
            ("user",  "Oui, en sécurité, sans risque inconsidéré."),
            ("alpha", "On a une stratégie de protection, le Bouclier Suisse, avec Whitney Tilson."),
            ("user",  "Et le prix ?"),
        ],
    },
    {
        "name": "Sceptique (ne doit PAS être forcé)",
        "expect_product": None, "expect_tier": None,
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Vos promesses ont l'air trop belles pour être vraies."),
            ("alpha", "Votre scepticisme est sain. Qu'est-ce qui vous a déçu avant ?"),
            ("user",  "Des conseillers qui m'ont fait perdre de l'argent avec des promesses bidon."),
            ("alpha", "Je comprends. Ici on documente, on ne promet pas. Que cherchez-vous ?"),
            ("user",  "Je sais pas. Prouvez-moi d'abord que c'est sérieux, sans baratin."),
            ("alpha", "Légitime. Nos experts publient leurs résultats, vous jugez."),
            ("user",  "On verra. Je donne pas mon argent comme ça."),
        ],
    },
    {
        "name": "Cadre actif pressé (délègue)",
        "expect_product": "argo_alpha", "expect_tier": "B",
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Thomas. Je suis cadre, j'ai pas le temps de gérer mes placements."),
            ("alpha", "Vous cherchez à déléguer la gestion ?"),
            ("user",  "Oui exactement, je veux que ce soit automatisé. J'ai 80 000 euros."),
            ("alpha", "L'automatisation, c'est notre créneau. Vous aimez la tech ?"),
            ("user",  "Oui la tech, l'IA, mais je veux surtout pas y passer du temps."),
            ("alpha", "On a Alpha, un agent IA qui gère la sélection pour vous, supervisé par Tilson."),
            ("user",  "Parfait, et le prix ?"),
        ],
    },
    {
        "name": "Gros patrimoine tech (500k)",
        "expect_product": "argo_alpha", "expect_tier": "B",
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Pierre. J'ai un patrimoine important, 500 000 euros, et je m'intéresse à l'IA."),
            ("alpha", "Vous investissez déjà beaucoup ?"),
            ("user",  "Oui pas mal. Je veux de la performance sur la tech et l'IA, du sérieux et délégué."),
            ("alpha", "On a un agent IA quantitatif. Je vous montre ?"),
            ("user",  "Oui, montrez-moi l'approche IA."),
            ("alpha", "Alpha, agent IA sur le Russell 1000, supervisé par Whitney Tilson."),
            ("user",  "Bien. Combien ça coûte ?"),
        ],
    },
    {
        "name": "Cadre immobilier moyen budget (60k value)",
        "expect_product": "argo_actions", "expect_tier": "B",
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Julien. J'investis dans l'immobilier, j'ai 60 000 euros à placer en bourse."),
            ("alpha", "Vous cherchez quoi pour cette somme ?"),
            ("user",  "De la croissance solide, du value, du long terme. Pas trop spéculatif."),
            ("alpha", "Le value long terme, c'est exactement Whitney Tilson."),
            ("user",  "Ah, quel produit pour ça ?"),
            ("alpha", "Actions Gagnantes, value américaine solide de Tilson."),
            ("user",  "Ok, le prix ?"),
        ],
    },
    {
        "name": "Abonné existant (cross-sell, doit pivoter)",
        "expect_product": None, "expect_tier": None, "forbid_product": "argo_actions",
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Marc. Je suis déjà abonné à Actions Gagnantes chez vous."),
            ("alpha", "Super Marc ! Vous voulez diversifier votre portefeuille ?"),
            ("user",  "Oui, j'aimerais compléter avec autre chose. J'ai 100 000 euros de plus à placer."),
            ("alpha", "On peut compléter votre value US avec de l'automatisation IA ou de l'asymétrie crypto."),
            ("user",  "Ah oui, dites-moi ce qui complète bien Actions Gagnantes."),
            ("alpha", "Pour automatiser une partie, il y a notre agent IA, Alpha."),
            ("user",  "Intéressant, et le prix ?"),
        ],
    },
    {
        "name": "Objection prix (produit doit tenir)",
        "expect_product": "argo_alpha", "expect_tier": "B",
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Sophie. J'ai 100 000 euros, je veux déléguer, j'aime la tech et l'IA."),
            ("alpha", "Parfait, on a un agent IA pour ça, Alpha."),
            ("user",  "Ok ça m'intéresse, c'est combien ?"),
            ("alpha", "997 euros par an, avec la garantie satisfait ou remboursé."),
            ("user",  "997 euros ?! C'est cher quand même, je trouve ça beaucoup."),
            ("alpha", "Je comprends que le montant vous interpelle."),
            ("user",  "Faut vraiment que ça vaille le coup à ce prix-là."),
        ],
    },
    {
        "name": "Curieux casse-pattern (dis-moi plus, refuse le prix)",
        "expect_product": "argo_alpha", "no_premature_close": True,
        "script": [
            ("alpha", "Bonjour, ici Argos. Votre prénom ?"),
            ("user",  "Paul. J'ai investi un peu, une dizaine de milliers d'euros en ETF tech, S&P et QQQ."),
            ("alpha", "Vous cherchez de la croissance sur la tech ?"),
            ("user",  "Oui faire grossir, j'aime la tech et l'IA."),
            ("alpha", "On a un agent IA, Alpha, supervisé par Whitney Tilson."),
            ("user",  "Ah ouais, dis-moi en plus, comment ça marche cette IA ?"),
            ("alpha", "L'agent IA scanne des milliers d'actions et en sélectionne 20, rééquilibrées chaque trimestre."),
            ("user",  "Ok dis-moi en plus."),
            ("alpha", "Il a repéré Nvidia avant sa hausse, un x65, et Cadence à plus 550 pour cent."),
            ("user",  "Dis-m'en plus."),
            ("alpha", "Il gère aussi activement le portefeuille pour optimiser les gains."),
            ("user",  "Non non, je veux pas que tu me parles du prix, dis-moi juste plus sur la strategie."),
        ],
    },
]


def run_profile(p):
    sess = post("/api/session", {}).get("session_id")
    log, active, dossier = [], None, {}
    cards, leaks, ungrounded = [], [], []
    last_price, last_tier, last_allowed, last_phase = None, None, 0, None
    chaleur, certitude, last_signal = None, None, None
    for role, text in p["script"]:
        log.append({"role": role, "text": text})
        tu = sum(1 for m in log if m["role"] == "user")
        if role == "user":
            coach = post("/api/strategist", {"history": log, "turn_number": tu, "mode": "mid_call",
                                             "session_id": sess, "agent_name": "Argos"})
            prod = (coach.get("produit") or {}) if isinstance(coach, dict) else {}
            chaleur = (coach.get("etat_emotionnel") or {}).get("chaleur") if isinstance(coach, dict) else None
            certitude = prod.get("certitude")
            last_signal = (coach.get("directive_prochain_tour") or {}).get("signal_closing") or last_signal
            if prod.get("recommande") and prod.get("certitude") in ("moyen", "ferme"):
                active = prod["recommande"]
            d = post("/api/ui-dossier", {"history": log, "previous_dossier": dossier})
            if isinstance(d, dict) and d.get("prenom") is not None and "_error" not in d:
                dossier = d
        else:
            c = post("/api/ui-cards", {"history": log, "active_product": active,
                                       "session_id": sess, "dossier": dossier})
            card = c.get("card") if isinstance(c, dict) else None
            if card:
                cards.append(card)
                ik = card.get("image_key")
                owner_set = OWNERS.get(ik) if ik else None
                if owner_set and active and active not in owner_set and ik not in GENERIC:
                    leaks.append((ik, sorted(owner_set)))
            b = post("/api/briefing", {"session_id": sess, "query": "prix exact et meilleurs chiffres pour convaincre",
                                       "capital": dossier.get("capital")})
            if isinstance(b, dict):
                pr = b.get("price_to_announce") or {}
                if pr.get("montant_euros") is not None:
                    last_price, last_tier = pr.get("montant_euros"), pr.get("tier_effectif")
                last_allowed = len(b.get("allowed_numbers", [])) or last_allowed
                last_phase = (b.get("PHASE_LOCK") or {}).get("phase_agent_autorisee")

    # Briefing FINAL : reflète la décision coach après le DERNIER tour (= le prix
    # que Argos annoncerait au closing). Évite l'artefact "briefing un tour en retard".
    bf = post("/api/briefing", {"session_id": sess, "query": "prix exact a annoncer",
                                "capital": dossier.get("capital")})
    if isinstance(bf, dict):
        prf = bf.get("price_to_announce") or {}
        if prf.get("montant_euros") is not None:
            last_price, last_tier = prf.get("montant_euros"), prf.get("tier_effectif")
        last_allowed = len(bf.get("allowed_numbers", [])) or last_allowed

    # --- Checks ---
    checks = []
    exp = p.get("expect_product")
    forbid = p.get("forbid_product")
    if exp and p.get("no_premature_close"):
        checks.append(("produit routé", active == exp, f"{active} (attendu {exp})"))
        checks.append(("PAS de closing prématuré (phase != prix_closing)", last_phase != "prix_closing", f"phase={last_phase}"))
        checks.append(("PAS de signal closing 'vert' sur pure curiosité", last_signal != "vert", f"signal={last_signal}"))
        checks.append(("cartes proposées", len(cards) > 0, f"{len(cards)}"))
        checks.append(("pas de fuite cross-produit", not leaks, f"{leaks if leaks else 'aucune'}"))
    elif exp:
        checks.append(("produit routé", active == exp, f"{active} (attendu {exp})"))
        checks.append(("tier", last_tier == p.get("expect_tier"), f"{last_tier} @ {last_price}EUR (attendu {p.get('expect_tier')})"))
        if p.get("expect_price") is not None:
            checks.append(("prix annoncé == carte (montant exact)", last_price == p.get("expect_price"),
                           f"{last_price}EUR (attendu {p.get('expect_price')}EUR)"))
        checks.append(("cartes proposées", len(cards) > 0, f"{len(cards)}"))
        checks.append(("pas de fuite cross-produit", not leaks, f"{leaks if leaks else 'aucune'}"))
        checks.append(("chiffres citables (voix)", last_allowed >= 4, f"{last_allowed}"))
    elif forbid:
        # cross-sell : doit recommander un produit, et PAS celui déjà possédé
        checks.append(("cross-sell : un produit recommandé", active is not None, f"{active}"))
        checks.append(("cross-sell : a PIVOTÉ (≠ produit déjà possédé)", active is not None and active != forbid, f"{active} (interdit: {forbid})"))
        checks.append(("cartes proposées", len(cards) > 0, f"{len(cards)}"))
        checks.append(("pas de fuite cross-produit", not leaks, f"{leaks if leaks else 'aucune'}"))
    else:
        # sceptique : ne doit PAS être verrouillé en closing prématuré
        checks.append(("sceptique non forcé (certitude != ferme)", certitude != "ferme", f"certitude={certitude}"))
        checks.append(("pas de carte offre prématurée", not any(c.get("template") == "offer_card" for c in cards), "ok" if not any(c.get("template") == "offer_card" for c in cards) else "offer_card affichée!"))

    # UNIVERSEL (bug #3) : le bouton S'inscrire (offer_card / product) ne doit
    # JAMAIS sortir avant le closing. Aucun de ces profils n'atteint prix_closing
    # -> 0 carte offre attendue.
    offer_now = [c for c in cards if (c.get("template") in ("offer_card", "product", "product_offer"))]
    closing = last_phase in ("prix_closing", "post_closing")
    checks.append(("offer_card seulement au closing", (not offer_now) or closing,
                   f"{len(offer_now)} offer_card hors closing, phase={last_phase}"))

    card_themes = ", ".join(f"{c.get('template')}:{c.get('image_key') or c.get('title','')[:14]}" for c in cards[:6])
    return {"name": p["name"], "active": active, "chaleur": chaleur, "certitude": certitude,
            "price": last_price, "tier": last_tier, "allowed": last_allowed, "phase": last_phase,
            "n_cards": len(cards), "themes": card_themes, "checks": checks}


def main():
    if not post("/api/session", {}).get("session_id"):
        print("Serveur non joignable sur :8000 — lance python3 server.py d'abord.")
        sys.exit(1)
    all_ok = True
    for p in PROFILES:
        r = run_profile(p)
        print("\n" + "=" * 92)
        print(f"PROFIL: {r['name']}")
        print(f"  -> produit={r['active']} | chaleur={r['chaleur']} | certitude={r['certitude']} | "
              f"prix={r['price']}EUR tier={r['tier']} | phase={r['phase']} | allowed_numbers={r['allowed']}")
        print(f"  -> {r['n_cards']} cartes: {r['themes']}")
        for label, ok, detail in r["checks"]:
            mark = "OK  " if ok else "FAIL"
            if not ok:
                all_ok = False
            print(f"     [{mark}] {label}: {detail}")
    print("\n" + "=" * 92)
    print("RÉSULTAT GLOBAL:", "TOUT OK" if all_ok else "DES CHECKS ONT ÉCHOUÉ (voir ci-dessus)")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
