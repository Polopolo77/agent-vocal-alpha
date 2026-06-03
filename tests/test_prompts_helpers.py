"""Tests des helpers purs de prompts.py corrigés à l'audit.

- _parse_capital_amount : doit gérer les formes que le LLM émet vraiment
  (« 2 millions », « environ 200000 », ranges) — sinon le verrou tier B >50k€
  est silencieusement contourné (bug revenu).
- _extract_numbers_from_sources : ne doit JAMAIS produire de chiffre partiel
  (« 900% » depuis « 8 900% ») ni de faux multiple (« x149 » depuis « Prix 149€ »)
  dans la whitelist citée par Argos (bug info financière trompeuse).

Lancer : python3 tests/test_prompts_helpers.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from prompts import _parse_capital_amount as cap
from prompts import _extract_numbers_from_sources
from prompts import _effective_tier as etier
from prompts import _guess_product_from_query as guess

OFFERS_GOLD = {"A": {"price_eur": 997}, "B": {"price_eur": 1997},
               "C": {"price_eur": 299}, "D": {"price_eur": 599}}
OFFERS_AB = {"A": {"price_eur": 149}, "B": {"price_eur": 299}}


def _nums(text):
    return _extract_numbers_from_sources([{"excerpt": text}])


# --- _parse_capital_amount ---------------------------------------------------

def test_cap_plain_int():
    assert cap(200000) == 200000


def test_cap_spaced_euros():
    assert cap("200 000 €") == 200000


def test_cap_millions_word():
    assert cap("2 millions") == 2_000_000


def test_cap_million_decimal():
    assert cap("1,5 million") == 1_500_000


def test_cap_k_suffix():
    assert cap("100k") == 100_000


def test_cap_environ_prefix():
    assert cap("environ 200000") == 200000


def test_cap_range_takes_first():
    assert cap("15 000 à 20 000") == 15000


def test_cap_word_without_digit_is_none():
    # "montant moyen" contient 'm' mais aucun nombre -> pas de faux x1 000 000
    assert cap("montant moyen") is None


def test_cap_dotted_thousands():
    assert cap("200.000") == 200000


def test_cap_50k_boundary():
    assert cap("50 000") == 50000


def test_cap_french_decimal_not_inflated():
    # BUG M6 : "100 000,00" valait 10 000 000 (decimale mangee) -> tier B a tort.
    assert cap("100 000,00 €") == 100000


def test_cap_decimal_half():
    assert cap("100 000,50") == 100000.5


def test_cap_decimal_dot():
    assert cap("2 500.75") == 2500.75


def test_cap_dotted_thousands_preserved():
    # La correction decimale ne doit PAS casser le separateur de milliers.
    assert cap("200.000") == 200000
    assert cap("1.000.000") == 1000000


def test_cap_mille_multiplier():
    # BUG L2 : "100 mille" -> 100000 (etait 100 -> refus de vente).
    assert cap("100 mille") == 100000
    assert cap("50 mille euros") == 50000


def test_cap_mille_word_boundary_no_false_match():
    # "famille" ne doit PAS declencher le multiplicateur mille.
    assert cap("ma famille a 8000 euros") == 8000


# --- _extract_numbers_from_sources ------------------------------------------

def test_nums_full_percent_no_partial():
    r = _nums("Netflix a fait +8 900% en 2012")
    assert "+8 900%" in r          # le vrai chiffre complet
    assert "900%" not in r          # PAS le bout partiel
    assert "+900%" not in r


def test_nums_no_false_x_multiple_in_prix():
    r = _nums("Prix de lancement 149€ par an")
    assert not any(x.lower().startswith("x") for x in r)  # pas de faux "x149"


def test_nums_keeps_real_multiple():
    r = _nums("Apple x475 depuis 2008")
    assert any("475" in x for x in r)


def test_nums_dollar_amount_no_partial():
    r = _nums("1 000$ investis en 1988")
    assert not any(x.strip() in ("000$", "000") for x in r)


# --- _guess_product_from_query : frontieres de mot (bug L3) ------------------

def test_guess_aga_no_false_match_in_word():
    # "aga" dans "magasin" ne doit plus router (frontiere de mot).
    assert guess("je cherche un magasin pas cher") is None


def test_guess_aga_real_match():
    assert guess("le produit AGA m'intéresse") == "argo_actions"


def test_guess_crypto_keywords():
    assert guess("je veux du bitcoin et des tokens") == "argo_crypto"


def test_guess_gold_keywords():
    assert guess("je m'intéresse à l'uranium et aux minières") == "argo_gold"


# --- _effective_tier : carte == voix, frontière 50k (bug capture Paul) -------

def test_tier_50k_boundary_is_A():
    # 50 000€ PILE n'est PAS > 50 000 -> tier A (997€), PAS B (1997€).
    assert etier(OFFERS_GOLD, 50000, None) == "A"


def test_tier_just_above_50k_is_B():
    assert etier(OFFERS_GOLD, 50001, None) == "B"


def test_tier_below_50k_is_A():
    assert etier(OFFERS_GOLD, 49999, None) == "A"


def test_tier_big_capital_is_B():
    assert etier(OFFERS_GOLD, 250000, None) == "B"


def test_tier_coach_B_ignored_at_50k():
    # Le coach (Flash-lite) dit B à 50k -> IGNORÉ, reste A (sinon carte≠voix).
    assert etier(OFFERS_GOLD, 50000, "B") == "A"


def test_tier_coach_A_ignored_above_50k():
    # Le coach dit A à 250k -> IGNORÉ, reste B (pas de sous-calibrage premium).
    assert etier(OFFERS_GOLD, 250000, "A") == "B"


def test_tier_coach_trial_C_honored():
    # "je veux tester" -> C respecté, même à gros capital.
    assert etier(OFFERS_GOLD, 250000, "C") == "C"


def test_tier_coach_trial_D_honored():
    assert etier(OFFERS_GOLD, 250000, "D") == "D"


def test_tier_trial_C_ignored_if_absent():
    # argo_actions n'a pas de tier C -> retombe sur la règle capital (B).
    assert etier(OFFERS_AB, 250000, "C") == "B"


def test_tier_capital_unknown_defaults_A():
    assert etier(OFFERS_GOLD, None, None) == "A"


def test_tier_capital_unknown_coach_B_still_A():
    assert etier(OFFERS_GOLD, None, "B") == "A"


def test_tier_no_B_offer_falls_to_A():
    assert etier({"A": {"price_eur": 149}}, 250000, None) == "A"


if __name__ == "__main__":
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
