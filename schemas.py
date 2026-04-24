"""
schemas.py — Modeles Pydantic pour les outputs JSON structures des agents auxiliaires.

Utilises avec `response_schema` dans les appels Gemini (coach, dossier) pour forcer
le decodeur contraint a respecter les enums et la structure. Elimine les JSON
invalides (champ manquant, valeur hors enum) qui causaient l'asymetrie voix/UI.

Usage :
    from schemas import CoachOutput
    config = {
        "response_mime_type": "application/json",
        "response_schema": CoachOutput,
        ...
    }
    response = client.models.generate_content(..., config=config)
    coach = CoachOutput.model_validate_json(response.text)  # validation stricte
"""

from __future__ import annotations

import logging
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


log = logging.getLogger(__name__)


# Gemini ne respecte pas toujours strictement les types string sur les champs
# pseudo-numeriques (capital, horizon). Il peut renvoyer 100000 (int) au lieu
# de "100 000 €" (str). coerce_numbers_to_str=True accepte les deux plutot
# que raise ValidationError -> fallback silencieux qui bypass le model_validator.
_LAX_STR = ConfigDict(coerce_numbers_to_str=True)


ProductId = Literal["argo_actions", "argo_crypto", "argo_alpha", "argo_gold"]
TierId = Literal["A", "B", "C", "D"]
Certitude = Literal["faible", "moyen", "ferme"]
Chaleur = Literal["froid", "tiede", "chaud", "pret_a_acheter"]
SignalClosing = Literal["rouge", "orange", "vert"]
AngleVente = Literal["croissance", "securite", "tech", "asymetrie"]
SpinStep = Literal["situation", "probleme", "implication", "need_payoff", "closing"]
Archetype = Literal[
    "retraite_prudent", "cadre_actif", "debutant_curieux", "sceptique", "abonne_existant"
]
PhaseAutorisee = Literal[
    "diagnostic",
    "recap_croise",
    "reveal_expert",
    "opportunite_concrete",
    "explication_service",
    "empilement_preuves",
    "mention_bonus",
    "fusion_6c_6d",
    "prix_closing",
    "post_closing",
]


# =============================================================================
# COACH schema
# =============================================================================


class ProfilDisc(BaseModel):
    dominant: Optional[int] = Field(None, ge=0, le=100)
    influent: Optional[int] = Field(None, ge=0, le=100)
    stable: Optional[int] = Field(None, ge=0, le=100)
    consciencieux: Optional[int] = Field(None, ge=0, le=100)
    confiance: int = Field(0, ge=0, le=100)
    justification: str = ""


class EtatEmotionnel(BaseModel):
    chaleur: Chaleur
    stress: str = "neutre"
    confiance_agent: str = "neutre"
    evolution: str = "stable"


class Spin(BaseModel):
    etape_actuelle: SpinStep
    prochaine_etape: SpinStep
    progression_pct: int = Field(0, ge=0, le=100)


class Memoire(BaseModel):
    declarations_cles: list[str] = Field(default_factory=list)
    peurs_exprimees: list[str] = Field(default_factory=list)
    traumatismes: list[str] = Field(default_factory=list)
    engagements_implicites: list[str] = Field(default_factory=list)
    contradictions_detectees: list[str] = Field(default_factory=list)


class Alternative(BaseModel):
    product_id: Optional[ProductId] = None
    raison: str = ""
    tier: Optional[TierId] = None


class Produit(BaseModel):
    recommande: Optional[ProductId] = None
    tier_recommande: Optional[TierId] = None
    certitude: Certitude = "faible"
    justification: str = ""
    alternatives_envisagees: list[Alternative] = Field(default_factory=list)


class Objections(BaseModel):
    evoquees: list[str] = Field(default_factory=list)
    levees: list[str] = Field(default_factory=list)
    en_cours: list[str] = Field(default_factory=list)


class DirectiveProchainTour(BaseModel):
    action_principale: str = ""
    tactique: str = ""
    formulation_suggeree: str = ""
    pieges_a_eviter: list[str] = Field(default_factory=list)
    angle_vente: Optional[AngleVente] = None
    signal_closing: SignalClosing = "rouge"


class DirectivePhase(BaseModel):
    phase_agent_autorisee: PhaseAutorisee = "diagnostic"
    contenus_interdits_ce_message: list[str] = Field(default_factory=list)
    lock_reason: str = ""
    must_wait_user_response: bool = True


class DossierField(BaseModel):
    model_config = _LAX_STR

    prenom: Optional[str] = None
    situation: list[str] = Field(default_factory=list)
    objectif: list[str] = Field(default_factory=list)
    horizon: Optional[str] = None
    capital: Optional[str] = None
    profil_detecte: Optional[str] = None
    vigilance: list[str] = Field(default_factory=list)
    questions_cles: list[str] = Field(default_factory=list)
    publication_recommandee: Optional[ProductId] = None


class CoachOutput(BaseModel):
    """Output JSON attendu du coach (gemini-2.5-flash-lite).

    Gemini applique ce schema au niveau du decodeur contraint : les champs enum
    sont forces aux valeurs autorisees a la generation, plus d'invalid_json
    ni de tier='premium' ou chaleur='tres_froid' hallucines.

    Validator model_validator : si le coach (LLM) recommande tier A pour un
    prospect avec capital > 50 000 €, on CORRIGE silencieusement a tier B.
    Ceinture supplementaire au QW-3 (override serveur dans briefing) : meme
    la directive coach elle-meme est desormais coherente, ce qui fiabilise
    les endpoints qui lisent coach.produit.tier_recommande directement
    (ex: /api/ui-cards pour choisir une offer_card, frontend pour overlay).
    """

    profil_disc: ProfilDisc = Field(default_factory=ProfilDisc)
    etat_emotionnel: EtatEmotionnel
    archetype_detecte: Optional[Archetype] = None
    spin: Spin
    memoire: Memoire = Field(default_factory=Memoire)
    produit: Produit
    objections: Objections = Field(default_factory=Objections)
    directive_prochain_tour: DirectiveProchainTour
    directive_phase: DirectivePhase = Field(default_factory=DirectivePhase)
    alertes: list[str] = Field(default_factory=list)
    card_a_afficher: Optional[str] = None
    dossier: DossierField

    @model_validator(mode="after")
    def _enforce_tier_b_above_50k(self) -> "CoachOutput":
        """Auto-correction : capital > 50k€ -> tier B (sauf si tier C/D = 'tester').

        Ne RAISE PAS (eviter qu'une correction legitime casse le flow). Log
        un warning si correction appliquee, pour monitoring.
        """
        if self.produit.recommande is None or self.produit.tier_recommande is None:
            return self
        if self.produit.tier_recommande not in ("A",):
            return self  # B/C/D OK, rien a faire
        capital_num = _parse_capital_for_validator(self.dossier.capital)
        if capital_num is None or capital_num <= 50_000:
            return self
        # Capital > 50k + coach a mis tier A -> FORCE tier B
        log.warning(
            "Coach tier A corrige -> B (capital=%s€ > 50k€, produit=%s)",
            capital_num,
            self.produit.recommande,
        )
        self.produit.tier_recommande = "B"
        return self


def _parse_capital_for_validator(raw: object) -> float | None:
    """Parse robuste du capital dans le model_validator (duplique simple du
    helper prompts._parse_capital_amount pour eviter import circulaire)."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw) if raw == raw else None
    s = str(raw).lower().replace(" ", "").replace("\u00a0", "")
    s = s.replace("€", "").replace("euros", "").replace("euro", "")
    multiplier = 1.0
    if "m" in s:
        multiplier = 1_000_000.0
        s = s.replace("m", "")
    elif "k" in s:
        multiplier = 1_000.0
        s = s.replace("k", "")
    s = s.replace(",", ".").strip()
    try:
        return float(s) * multiplier
    except (ValueError, TypeError):
        return None


# =============================================================================
# UI CARDS schema
# =============================================================================


CardTemplate = Literal[
    # Vente classique (LLM-selected)
    "proof_number",
    "expert_portrait",
    "opportunity",
    "comparison",
    "testimonial",
    "track_record",
    "offer_card",
    "guarantee_generic",
    # Phase diagnostic (peuvent aussi etre LLM-selected)
    "welcome_steps",
    "rgpd_notice",
    "live_market",
    "did_you_know",
    "patrimony_chart",
    "glossary",
    "no_commit",
    "analysis_cross",
]


class Card(BaseModel):
    """Carte visuelle affichee dans le stack cote client."""

    image_key: Optional[str] = None
    template: CardTemplate
    title: Optional[str] = None
    subtitle: Optional[str] = None
    quote: Optional[str] = None
    items: Optional[list[str]] = None


class UICardsOutput(BaseModel):
    """Output du cards agent (gemini-3.0-flash). `card` peut etre null quand
    rien de pertinent ne doit etre affiche (question ouverte, hors-sujet)."""

    card: Optional[Card] = None
    reasoning: str = ""
