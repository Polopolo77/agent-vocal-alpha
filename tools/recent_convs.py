#!/usr/bin/env python3
"""Affiche et analyse les DERNIÈRES conversations vocales d'Argos.

Lit /api/conversations sur le backend (auth admin) et, pour chaque conversation
récente, détecte automatiquement les problèmes connus :
  - FUITE du briefing interne (directives/prix/PHASE_LOCK vocalisés)
  - RE-BONJOUR (Argos se re-présente -> reconnexion qui a perdu le contexte)
  - PRIX incohérent (plusieurs montants €/an annoncés)
  - RÉPÉTITION quasi-identique d'un message de l'agent

La clé admin n'est JAMAIS écrite dans ce fichier : on la lit dans l'env
ADMIN_API_KEY (ou via --key). Par défaut on n'affiche PAS le contenu (PII) ;
ajoute --full pour voir les transcripts.

Usage :
  ADMIN_API_KEY=xxxx python3 tools/recent_convs.py            # 5 dernières, méta + alertes
  ADMIN_API_KEY=xxxx python3 tools/recent_convs.py 10         # 10 dernières
  ADMIN_API_KEY=xxxx python3 tools/recent_convs.py 3 --full   # + transcripts
  python3 tools/recent_convs.py --key xxxx
"""
import json
import os
import ssl
import sys
import urllib.request

BACKEND = os.getenv("ARGO_BACKEND", "https://argo-editions.up.railway.app")

# SSL fiable même si le trust store système est cassé (macOS local notamment).
try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL_CTX = ssl.create_default_context()

# Marqueurs typiques d'une fuite du briefing interne dans le transcript.
LEAK_MARKERS = [
    "phase_agent_autorisee", "price_to_announce", "instruction_stricte",
    "allowed_numbers", "tier_effectif", "PHASE_LOCK", "produit_cible",
    "scheduling", "instruction_interne", "lock_reason", "checkout_url",
    "must_wait_user_response", "formulation_suggeree", "archetype",
]
GREET = "puis-je vous demander votre prénom"


def _msg_text(m):
    if isinstance(m, dict):
        return str(m.get("text") or m.get("content") or m.get("transcript") or "")
    return str(m)


def _msg_role(m):
    if isinstance(m, dict):
        return str(m.get("role") or m.get("speaker") or m.get("source") or "?")
    return "?"


def extract_events(messages):
    """Parse les entrees role:'monitor' -> evenements (cartes/dossier/coach/briefing)."""
    evs = []
    for m in messages:
        if _msg_role(m) == "monitor":
            try:
                evs.append(json.loads(_msg_text(m)))
            except Exception:
                pass
    evs.sort(key=lambda e: (e.get("t", 0), e.get("turn", 0)))
    return evs


def monitor_summary(events):
    """Resume compact du deroule observe (ce que Argos a fait, quand, en combien de temps)."""
    if not events:
        return ["(pas de donnees monitor — conversation d'avant l'instrumentation)"]
    sess = next((e for e in events if e.get("type") == "session"), None)
    cards = [e for e in events if e.get("type") == "card"]
    doss = [e for e in events if e.get("type") == "dossier"]
    coach = [e for e in events if e.get("type") == "coach"]
    brief = [e for e in events if e.get("type") == "briefing"]
    turns = [e for e in events if e.get("type") == "turn"]
    interrupts = [e for e in events if e.get("type") == "interrupted"]
    lines = []
    if sess:
        lines.append(f"session : {sess.get('agent')} / {sess.get('model')} / voix {sess.get('voice')} / VAD {sess.get('vad')}")
    # LATENCE DE REPONSE (metrique cle : en combien de temps l'agent repond)
    lats = [t.get("latence_ms") for t in turns if isinstance(t.get("latence_ms"), (int, float))]
    if lats:
        avg = sum(lats) // len(lats)
        slow = sum(1 for L in lats if L > 2500)
        lines.append(f"latence reponse : moy {avg}ms, max {max(lats)}ms ({len(lats)} tours"
                     + (f", ⚠️ {slow} lents >2.5s" if slow else "") + ")")
    noresp = sum(1 for t in turns if t.get("user") and not t.get("agent"))
    if noresp:
        lines.append(f"⚠️ {noresp} tour(s) SANS reponse agent (user a parle, agent muet)")
    if interrupts:
        lines.append(f"barge-in (agent coupe) : {len(interrupts)}x")
    lines.append("cartes : " + (", ".join(
        f"{c.get('template')}:{c.get('key')}@{c.get('t')}s" for c in cards) if cards else "AUCUNE"))
    if doss:
        maxf = max((d.get("n_filled", 0) for d in doss), default=0)
        last = doss[-1]
        lines.append(f"dossier : {maxf}/8 champs (final prenom={last.get('prenom')} "
                     f"capital={last.get('capital')} objectif={last.get('objectif')} profil={last.get('profil')})")
    if coach:
        phases = []
        for c in coach:
            p = c.get("phase")
            if p and (not phases or phases[-1] != p):
                phases.append(p)
        prods = sorted({c.get("product") for c in coach if c.get("product")})
        lines.append(f"coach : produit={prods or '-'} | phases={' -> '.join(phases) or '-'} | signal final={coach[-1].get('signal')}")
    if brief:
        bms = [b.get("ms") for b in brief if isinstance(b.get("ms"), (int, float))]
        lines.append(f"briefings : {len(brief)}" + (f" (lat moy {sum(bms)//len(bms)}ms)" if bms else ""))
    return lines


def monitor_timeline(events):
    """Deroule chronologique detaille (--full) : tours+latences, cartes+contexte, coach, briefings."""
    out = []
    for e in events:
        ty, t = e.get("type"), e.get("t")
        if ty == "turn":
            lat = e.get("latence_ms")
            tag = f"[reponse en {lat}ms]" if isinstance(lat, (int, float)) else "[!! PAS DE REPONSE]"
            out.append(f"  t{t}s · tour {e.get('turn')} {tag}")
            if e.get("user"):
                out.append(f"        USER : {e.get('user')}")
            if e.get("agent"):
                out.append(f"        ARGOS: {e.get('agent')}")
        elif ty == "card":
            ctx = e.get("ctx_bot") or e.get("ctx_user") or ""
            out.append(f"  t{t}s · CARTE {e.get('template')}:{e.get('key')}  (pendant: \"...{ctx}\")")
        elif ty == "coach":
            out.append(f"  t{t}s · COACH produit={e.get('product')} tier={e.get('tier')} "
                       f"phase={e.get('phase')} signal={e.get('signal')} chaleur={e.get('chaleur')}")
        elif ty == "briefing":
            out.append(f"  t{t}s · BRIEFING phase={e.get('phase')} prix={e.get('price')} "
                       f"chiffres={e.get('allowed')} ({e.get('ms')}ms)")
        elif ty == "interrupted":
            out.append(f"  t{t}s · BARGE-IN (agent coupe: \"...{e.get('agent_disait')}\")")
        elif ty == "dossier":
            out.append(f"  t{t}s · DOSSIER {e.get('n_filled')}/8 (capital={e.get('capital')})")
        elif ty == "session":
            out.append(f"  SESSION {e.get('agent')} / {e.get('model')} / {e.get('voice')} / VAD {e.get('vad')}")
    return out


def analyze(messages):
    issues = []
    # On n'analyse QUE le transcript parle (pas les entrees monitor).
    messages = [m for m in messages if _msg_role(m) != "monitor"]
    pairs = [(_msg_role(m), _msg_text(m)) for m in messages]
    full = "\n".join(t for _, t in pairs)
    low = full.lower()

    hits = [mk for mk in LEAK_MARKERS if mk in full]
    if len(hits) >= 2:
        issues.append(f"FUITE briefing interne (marqueurs: {', '.join(hits[:5])})")

    if low.count(GREET) > 1:
        issues.append(f"RE-BONJOUR x{low.count(GREET)} (reconnexion -> contexte perdu)")

    # plusieurs prix distincts annoncés (ex 149€ puis 1997€)
    import re
    prices = set(re.findall(r"(\d[\d\s]{1,6})\s*(?:€|euros?)\s*(?:/?\s*an|par an)", low))
    norm = {p.replace(" ", "") for p in prices}
    if len(norm) > 1:
        issues.append(f"PRIX incohérents annoncés : {sorted(norm)}")

    # répétition quasi-identique de l'agent (>=40 car, 2x)
    seen = {}
    for role, t in pairs:
        if role.lower() in ("user", "prospect"):
            continue
        key = t.strip().lower()[:80]
        if len(key) >= 40:
            seen[key] = seen.get(key, 0) + 1
    rep = [k for k, v in seen.items() if v > 1]
    if rep:
        issues.append(f"RÉPÉTITION agent (1er répété: \"{rep[0][:50]}…\")")

    return issues


def main():
    argv = sys.argv[1:]
    full = "--full" in argv
    key = ""
    if "--key" in argv:
        key = argv[argv.index("--key") + 1]
    key = key or os.getenv("ADMIN_API_KEY", "")
    n = next((int(a) for a in argv if a.isdigit()), 5)

    if not key:
        print("ERREUR : clé admin manquante. Fournis ADMIN_API_KEY (env) ou --key <clé>.")
        sys.exit(1)

    req = urllib.request.Request(
        BACKEND + "/api/conversations", headers={"X-Admin-Key": key}
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as r:
            data = json.load(r)
    except Exception as e:
        print(f"ERREUR fetch : {e}")
        sys.exit(1)

    convs = (data.get("conversations") or [])[:n]
    print(f"=== {len(convs)} dernières conversations · {BACKEND} ===\n")

    total_leak = 0
    for c in convs:
        msgs = c.get("messages") or []
        issues = analyze(msgs)
        if any(i.startswith("FUITE") for i in issues):
            total_leak += 1
        head = (f"#{c.get('id')} | {c.get('started_at', '?')} | "
                f"{c.get('product_id') or '-'} | {len(msgs)} msgs | "
                f"{c.get('duration_seconds', 0)}s")
        print(head)
        if issues:
            for i in issues:
                print(f"   ⚠️  {i}")
        else:
            print("   ✓ rien d'anormal détecté")
        events = extract_events(msgs)
        for line in monitor_summary(events):
            print(f"   · {line}")
        if full:
            print("   ---------- timeline ----------")
            for line in monitor_timeline(events):
                print(line)
        print()

    print(f"Résumé : {total_leak}/{len(convs)} conversations avec FUITE briefing.")


if __name__ == "__main__":
    main()
