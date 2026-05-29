"""Ancrage des chiffres sur les Smart Cards (anti-hallucination visuelle).

Logique PURE (pas d'I/O, pas de REGISTRY) — server.py l'importe pour le verrou
serveur, et les tests tournent sans booter les embeddings/API.

Principe : un chiffre affiché sur une carte `proof_number`/`track_record` DOIT
exister dans la lettre de vente OU le config du produit. Le LLM cards choisit
QUELLE carte montrer, il n'invente jamais le stat — exactement la discipline
déjà appliquée à la voix d'Argos (allowed_numbers), étendue à l'écran.
"""
from __future__ import annotations

import json
import re

# Templates dont un chiffre faux serait un mensonge visuel. Les autres
# (expert_portrait, opportunity, comparison, testimonial...) ne sont pas
# soumis à l'ancrage : leurs nombres sont des credentials/contexte.
_NUMERIC_CLAIM_TEMPLATES = ("proof_number", "track_record")

# Espaces insécables / fines utilisés comme séparateurs de milliers FR. On les
# ramène à l'espace ASCII AVANT matching (échappements \u -> aucun caractère
# invisible dans ce fichier).
_WS_RE = re.compile(r"[     ]")
_NUM_BODY = r"\d[\d .,]*\d|\d"
# Claim de perf = soit >=3 chiffres (>=100), soit un multiple "xNN". Les petits
# entiers nus (20 ans, 4 publications, 60%) ne sont PAS contraints.
_CLAIM_RE = re.compile(r"(x\s*)?(" + _NUM_BODY + r")", re.IGNORECASE)
_ANY_NUM_RE = re.compile(_NUM_BODY)
_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)


def _norm_text(s: str) -> str:
    return _WS_RE.sub(" ", s or "")


def _digits(raw: str) -> str:
    """'47 400' -> '47400', '02' -> '2'. Garde les chiffres, retire les zéros
    de tête (normalisation pour comparaison)."""
    d = re.sub(r"\D", "", raw)
    if not d:
        return ""
    return d.lstrip("0") or "0"


def significant_numbers(text: str) -> set[str]:
    """Extrait les claims chiffrés normalisés d'un texte de carte."""
    if not text:
        return set()
    t = _norm_text(text).lower()
    out: set[str] = set()
    for m in _CLAIM_RE.finditer(t):
        is_multiple = bool(m.group(1))
        norm = _digits(m.group(2))
        if not norm:
            continue
        if is_multiple or len(norm) >= 3:
            out.add(norm)
    return out


def build_number_whitelist(full_markdown: str, config: dict) -> set[str]:
    """Tous les chiffres présents dans la lettre + le config = chiffres
    autorisés à l'affichage. Les URLs (tracking codes) sont retirées d'abord."""
    text = full_markdown or ""
    try:
        text += " " + json.dumps(config or {}, ensure_ascii=False)
    except (TypeError, ValueError):
        pass
    text = _norm_text(_URL_RE.sub(" ", text))
    out: set[str] = set()
    for m in _ANY_NUM_RE.finditer(text):
        norm = _digits(m.group(0))
        if norm:
            out.add(norm)
    return out


def card_numbers_grounded(card: dict, whitelist: set[str]) -> bool:
    """True si la carte n'affiche aucun chiffre fabriqué. Les templates non
    numériques (et les cartes sans claim chiffré) passent toujours."""
    if not isinstance(card, dict):
        return True
    if (card.get("template") or "") not in _NUMERIC_CLAIM_TEMPLATES:
        return True
    parts = [str(card.get("title", "") or ""), str(card.get("subtitle", "") or "")]
    items = card.get("items")
    if isinstance(items, list):
        parts.extend(str(x) for x in items)
    claims = significant_numbers(" ".join(parts))
    if not claims:
        return True
    return all(c in whitelist for c in claims)


# =============================================================================
# Attribution cross-produit d'une carte (verrous serveur #1/#2)
# =============================================================================
# Marqueurs textuels -> produit(s) propriétaire(s). Les entités PARTAGÉES
# listent plusieurs owners : le verrou ne rejette une carte que si le produit
# actif n'est dans AUCUN owner possible. Corrige le bug où une carte Tilson
# (Tilson supervise argo_actions ET argo_alpha) était rejetée à tort en session
# alpha. 'laramide' (marqueur périmé, aucune image) retiré ; 'delysium',
# 'agnico', 'nvidia' ajoutés.
_ACTIONS_ALPHA = frozenset({"argo_actions", "argo_alpha"})  # Tilson & ses positions
_MARKER_OWNERS: dict[str, frozenset] = {
    "tilson": _ACTIONS_ALPHA,
    "buffett": _ACTIONS_ALPHA,
    "netflix": _ACTIONS_ALPHA,
    "sodastream": _ACTIONS_ALPHA,
    "ggp": _ACTIONS_ALPHA,
    "general growth": _ACTIONS_ALPHA,
    "actions gagnantes": frozenset({"argo_actions"}),
    "bouclier suisse": frozenset({"argo_actions"}),
    "eric wade": frozenset({"argo_crypto"}),
    "wade": frozenset({"argo_crypto"}),
    "fin du travail": frozenset({"argo_crypto"}),
    "polymath": frozenset({"argo_crypto"}),
    "harmony": frozenset({"argo_crypto"}),
    "enjin": frozenset({"argo_crypto"}),
    "luna": frozenset({"argo_crypto"}),
    "ia physique": frozenset({"argo_crypto"}),
    "profits asymétriques": frozenset({"argo_crypto"}),
    "nvidia": frozenset({"argo_crypto", "argo_alpha"}),  # couvert par les deux
    "stansberry": frozenset({"argo_alpha"}),
    "agent alpha": frozenset({"argo_alpha"}),
    "alpha ia": frozenset({"argo_alpha"}),
    "russell 1000": frozenset({"argo_alpha"}),
    "renaissance": frozenset({"argo_alpha"}),
    "simons": frozenset({"argo_alpha"}),
    "cadence design": frozenset({"argo_alpha"}),
    "synopsys": frozenset({"argo_alpha"}),
    "lumentum": frozenset({"argo_alpha"}),
    "delysium": frozenset({"argo_alpha"}),
    "agnico": frozenset({"argo_alpha"}),
    "score alpha": frozenset({"argo_alpha"}),
    "dan ferris": frozenset({"argo_gold"}),
    "ferris": frozenset({"argo_gold"}),
    "crocodile": frozenset({"argo_gold"}),
    "vista gold": frozenset({"argo_gold"}),
    "ssr mining": frozenset({"argo_gold"}),
    "forsys": frozenset({"argo_gold"}),
    "uranium": frozenset({"argo_gold"}),
    "minière": frozenset({"argo_gold"}),
    "hyper climax": frozenset({"argo_gold"}),
    "détonateur": frozenset({"argo_gold"}),
    "haut rendement": frozenset({"argo_gold"}),
    "extreme value": frozenset({"argo_gold"}),
}


def card_owner_candidates(card: dict) -> set:
    """Produits possibles d'une carte d'après son contenu (title+subtitle+image_key).
    Vide si aucun marqueur. Les entités partagées (Tilson, Nvidia) renvoient
    plusieurs produits → le verrou ne rejette que si l'actif n'est dans aucun."""
    if not isinstance(card, dict):
        return set()
    blob = " ".join(
        str(card.get(k, "") or "") for k in ("title", "subtitle", "image_key")
    ).lower()
    if not blob.strip():
        return set()
    owners: set = set()
    for marker, pids in _MARKER_OWNERS.items():
        if marker in blob:
            owners |= pids
    return owners
