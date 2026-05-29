"""Tests — ancrage des chiffres sur les Smart Cards (anti-hallucination visuelle).

Le LLM cards (gemini-3.0-flash) peut écrire n'importe quel chiffre dans le
`title`/`subtitle` d'une carte `proof_number`/`track_record`. La voix d'Argos est
déjà whitelistée (allowed_numbers), mais PAS les cartes. Ce module fournit la
logique PURE qui valide qu'un chiffre affiché existe bien dans la lettre de
vente + le config du produit. server.py l'importe pour le verrou serveur.

Pur — n'importe PAS server.py (pas de boot embeddings/API/REGISTRY).
Lancer : python3 tests/test_cards_grounding.py   (ou pytest tests/)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from card_grounding import (
    build_number_whitelist,
    significant_numbers,
    card_numbers_grounded,
    card_owner_candidates,
)
from prompts import _card_theme_from_key


# --- significant_numbers : ce qui compte comme "claim chiffré" ---------------

def test_significant_numbers_joins_thousands_separator():
    # "+47 400%" doit être lu comme le seul nombre 47400 (espace = séparateur)
    assert "47400" in significant_numbers("+47 400%")


def test_significant_numbers_detects_x_multiple_even_two_digits():
    # un multiple "x77" est un claim de perf même avec 2 chiffres
    assert "77" in significant_numbers("x77")


def test_significant_numbers_ignores_small_plain_integers():
    # "20 ans" n'est pas un claim de performance
    assert significant_numbers("20 ans d'expérience à Wall Street") == set()


# --- build_number_whitelist : source = lettre + config -----------------------

def test_build_whitelist_from_letter_and_config():
    letter = "Tilson a sorti Netflix à +8 900% et Apple en x475."
    config = {"track_record": {"notable_wins": [{"return_pct": 1600}]}}
    wl = build_number_whitelist(letter, config)
    assert "8900" in wl
    assert "475" in wl
    assert "1600" in wl


def test_build_whitelist_strips_url_tracking_codes():
    # les digits des checkout_url ne doivent pas polluer la whitelist
    config = {"offers": {"A": {"checkout_url": "https://x.com/?trackingCode=ARO793620001"}}}
    wl = build_number_whitelist("", config)
    assert "793620001" not in wl


# --- card_numbers_grounded : le verrou -------------------------------------

def test_proof_number_grounded_when_value_in_whitelist():
    card = {"template": "proof_number", "title": "+8 900%", "subtitle": "Netflix — Tilson"}
    assert card_numbers_grounded(card, {"8900"}) is True


def test_proof_number_rejected_when_value_fabricated():
    card = {"template": "proof_number", "title": "+12 000%", "subtitle": "Netflix"}
    assert card_numbers_grounded(card, {"8900"}) is False


def test_track_record_items_are_checked():
    card = {"template": "track_record", "title": "Or", "items": ["Forsys +10 900%"]}
    assert card_numbers_grounded(card, {"8900"}) is False
    assert card_numbers_grounded(card, {"10900"}) is True


def test_non_numeric_templates_always_grounded():
    # expert_portrait, opportunity, comparison… ne sont pas soumis à l'ancrage
    card = {"template": "expert_portrait", "title": "Whitney Tilson",
            "subtitle": "Formé par Buffett", "items": ["20 ans à Wall Street"]}
    assert card_numbers_grounded(card, set()) is True


def test_proof_number_without_any_number_is_grounded():
    card = {"template": "proof_number", "title": "Bouclier Suisse", "subtitle": "Sécurité"}
    assert card_numbers_grounded(card, set()) is True


# --- card_owner_candidates : attribution cross-produit (verrous #1/#2) --------

def test_owner_candidates_tilson_shared_actions_and_alpha():
    # Tilson = expert d'argo_actions ET superviseur d'argo_alpha → partagé
    assert card_owner_candidates({"title": "Whitney Tilson", "subtitle": ""}) == {"argo_actions", "argo_alpha"}


def test_owner_candidates_netflix_shared_actions_and_alpha():
    assert card_owner_candidates({"title": "+8 900%", "subtitle": "Netflix — Tilson"}) == {"argo_actions", "argo_alpha"}


def test_owner_candidates_ferris_gold_only():
    assert card_owner_candidates({"title": "Dan Ferris", "subtitle": "Le Crocodile"}) == {"argo_gold"}


def test_owner_candidates_wade_crypto_only():
    assert card_owner_candidates({"subtitle": "Eric Wade"}) == {"argo_crypto"}


def test_owner_candidates_empty_when_no_marker():
    assert card_owner_candidates({"title": "Bonjour", "subtitle": "comment allez-vous"}) == set()


def test_owner_candidates_laramide_removed():
    # 'laramide' était un marqueur périmé (aucune image dans argo_gold) → retiré
    assert card_owner_candidates({"subtitle": "Laramide"}) == set()


def test_owner_candidates_alpha_tilson_not_wrongly_attributed():
    # Bug F8 : une carte Tilson en session alpha ne doit PAS être rejetée.
    cands = card_owner_candidates({"title": "Whitney Tilson"})
    assert "argo_alpha" in cands       # alpha actif → carte gardée
    assert "argo_gold" not in cands    # gold actif → carte rejetée (correct)


# --- _card_theme_from_key : bucketing thématique (prompts.py) -----------------

def test_theme_proof_quote_is_danger_not_perf():
    # Déclaration politique en capture : preuve/danger, PAS un chiffre de perf
    assert _card_theme_from_key("proof_politique_gauche", "proof_quote", "Declaration Sandrine Rousseau") == "danger"


def test_theme_excludes_chrome_assets():
    for role in ("background", "logo", "brand", "symbol", "diagram"):
        assert _card_theme_from_key("whatever", role, "un asset") is None, role


def test_theme_authority_is_expert():
    assert _card_theme_from_key("authority_tilson", "authority", "Portrait Tilson") == "expert_name"


def test_theme_proof_chart_is_perf():
    assert _card_theme_from_key("proof_netflix", "proof_chart", "Netflix +8900%") == "perf_number"


def test_theme_product_shot_is_offer():
    assert _card_theme_from_key("product_main", "product_shot", "Pile de numeros") == "offer"


def test_theme_guarantee_badge_is_guarantee():
    assert _card_theme_from_key("guarantee_badge", "proof_symbol", "Badge garantie 90 jours") == "guarantee"


if __name__ == "__main__":
    # Runner autonome (pas de dépendance pytest dans ce repo)
    import traceback

    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
        except Exception:
            failed += 1
            print(f"  FAIL  {t.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
