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
