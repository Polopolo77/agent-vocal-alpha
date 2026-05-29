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
