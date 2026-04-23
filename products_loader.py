"""
products_loader.py — Chargement, chunking et indexation BM25 des produits Argo.

Au démarrage du serveur :
  1. Lit `products/catalog.json` pour lister les produits READY.
  2. Pour chaque produit, charge `config.json`, `sales_letter.md`, `images.json`.
  3. Chunke le Markdown par section (balises `<!-- section:xxx -->`).
  4. Construit un index BM25 en RAM par produit.
  5. Expose `search(product_id, query, k=4)` pour /api/briefing.

Pas de dépendance réseau, pas de cache disque : tout en RAM.
"""

from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi

log = logging.getLogger(__name__)

# --- Embeddings (semantic retrieval, remplace/complete BM25) ----------------
# Default = gemini-embedding-2 (GA avril 2026, multimodal, 8192 tokens context,
# +5 pts MTEB vs 001). Breaking changes : task_type inclus dans le prompt au
# lieu d'un parametre, et batch = aggregation (donc on boucle).
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-2")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "768"))
USE_EMBEDDINGS = os.getenv("USE_EMBEDDINGS", "1") not in ("0", "false", "False")

# Lazy import du client Gemini — seulement si on fait des embeddings.
_genai_client = None
def _get_genai_client():
    global _genai_client
    if _genai_client is not None:
        return _genai_client
    try:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            return None
        _genai_client = genai.Client(api_key=api_key)
        return _genai_client
    except Exception as e:
        log.warning("Failed to init genai client for embeddings: %s", e)
        return None


def _is_v2_model(model: str = EMBEDDING_MODEL) -> bool:
    """True si le model utilise l'API v2 (task_type dans le prompt)."""
    return "embedding-2" in model


def _format_for_embedding(text: str, task_type: str, title: str | None = None) -> str:
    """Formate le texte selon la convention v2 (task_type dans le prompt).
    Pour v1, retourne le texte brut (task_type sera en config).
    """
    if not _is_v2_model():
        return text
    # Gemini Embedding 2 : format prompt-based
    if task_type == "RETRIEVAL_DOCUMENT":
        if title:
            return f"title: {title} | text: {text}"
        return f"text: {text}"
    elif task_type == "RETRIEVAL_QUERY":
        return f"task: search result | query: {text}"
    elif task_type == "SEMANTIC_SIMILARITY":
        return f"task: sentence similarity | text: {text}"
    return text


def _embed_one(text: str, task_type: str, title: str | None = None) -> np.ndarray | None:
    """Embed un seul texte. Returns numpy vector (float32) ou None."""
    client = _get_genai_client()
    if not client or not text:
        return None
    try:
        from google.genai import types as genai_types
        formatted = _format_for_embedding(text, task_type, title)

        # Pour v2 : pas de task_type parameter, config juste avec output_dim.
        # Pour v1 : task_type est un parametre du config.
        if _is_v2_model():
            cfg = genai_types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIM)
        else:
            cfg = genai_types.EmbedContentConfig(
                output_dimensionality=EMBEDDING_DIM,
                task_type=task_type,
            )

        result = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=formatted,
            config=cfg,
        )
        if result and result.embeddings and len(result.embeddings) > 0:
            return np.asarray(result.embeddings[0].values, dtype=np.float32)
        return None
    except Exception as e:
        log.warning("Embedding call failed (%s, %s): %s", EMBEDDING_MODEL, task_type, str(e)[:200])
        return None


def _embed_batch(items: list[tuple[str, str | None]], task_type: str, max_workers: int = 6) -> list[np.ndarray | None]:
    """Embed une liste d'items (text, title_optional).

    - Pour v2 (gemini-embedding-2) : embed_content avec plusieurs contents
      retourne 1 vecteur AGREGE (pas N). On boucle donc en parallele via
      ThreadPoolExecutor pour accelerer le boot.
    - Pour v1 : batch natif (plus rapide).
    """
    if not items:
        return []
    if _is_v2_model():
        # Loop parallelise pour limiter la latence boot
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=max_workers) as pool:
            results = list(pool.map(
                lambda it: _embed_one(it[0], task_type, it[1]),
                items,
            ))
        return results
    # v1 : batch classique
    client = _get_genai_client()
    if not client:
        return [None] * len(items)
    try:
        from google.genai import types as genai_types
        texts = [it[0] for it in items]
        result = client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=texts,
            config=genai_types.EmbedContentConfig(
                output_dimensionality=EMBEDDING_DIM,
                task_type=task_type,
            ),
        )
        return [np.asarray(e.values, dtype=np.float32) for e in result.embeddings]
    except Exception as e:
        log.warning("Batch embed v1 failed: %s", e)
        return [None] * len(items)


# Cache LRU pour les queries repetees (gains de latence + coût)
@lru_cache(maxsize=512)
def _embed_query_cached(query: str) -> tuple | None:
    vec = _embed_one(query, "RETRIEVAL_QUERY")
    if vec is None:
        return None
    return tuple(vec.tolist())


def _cosine_top_k(query_vec: np.ndarray, doc_vecs: np.ndarray, k: int) -> list[tuple[int, float]]:
    """Top-k cosine similarity. doc_vecs shape: (N, D). Returns [(idx, score), ...]."""
    if doc_vecs.size == 0:
        return []
    # Normalize
    qn = np.linalg.norm(query_vec) + 1e-10
    dn = np.linalg.norm(doc_vecs, axis=1) + 1e-10
    sims = (doc_vecs @ query_vec) / (dn * qn)
    top_idx = np.argsort(-sims)[:k]
    return [(int(i), float(sims[i])) for i in top_idx]

ROOT = Path(__file__).resolve().parent
PRODUCTS_DIR = ROOT / "products"
CATALOG_PATH = PRODUCTS_DIR / "catalog.json"

# Séparateur de chunk dans les sales_letter.md
SECTION_MARKER = re.compile(r"<!--\s*section:([a-zA-Z0-9_]+)\s*-->")
# YAML frontmatter
FRONTMATTER = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)

# Stopwords FR minimaux (pas besoin d'un truc énorme en BM25)
STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "et", "ou", "mais",
    "donc", "car", "ni", "que", "qui", "quoi", "dont", "où", "ce", "cet", "cette",
    "ces", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre",
    "votre", "leurs", "à", "au", "aux", "en", "dans", "sur", "sous", "avec", "pour",
    "par", "sans", "vers", "chez", "entre", "je", "tu", "il", "elle", "nous", "vous",
    "ils", "elles", "on", "se", "sa", "s", "t", "m", "n", "y", "est", "sont", "a",
    "ont", "avoir", "être", "plus", "moins", "très", "aussi", "déjà", "pas", "ne",
    "si", "dont", "tout", "tous", "toute", "toutes",
    "justement", "même", "plutôt", "simplement", "finalement", "vraiment",
    "peut", "faire", "comme", "quand", "encore", "bien", "fait", "dit", "ça", "c",
}


@dataclass
class Chunk:
    product_id: str
    section: str           # ex: "proof", "offer", "authority"
    title: str | None      # premier header du chunk si présent
    text: str              # texte du chunk
    tokens: list[str] = field(default_factory=list)
    embedding: np.ndarray | None = None  # vecteur dense (RETRIEVAL_DOCUMENT)


@dataclass
class Product:
    product_id: str
    slug: str
    product_name: str
    vertical: str
    expert: str
    config: dict          # config.json entier
    images: dict          # images.json entier
    frontmatter: dict     # YAML frontmatter du MD
    chunks: list[Chunk] = field(default_factory=list)
    bm25: BM25Okapi | None = None
    chunks_matrix: np.ndarray | None = None  # (N, D) stack des embeddings
    summary_section: str = ""  # section "summary" du MD, utile pour l'overlay prompt
    full_markdown: str = ""    # MD complet sans frontmatter


# ---------- helpers ----------------------------------------------------------

def _tokenize(text: str) -> list[str]:
    """Tokenizer FR simple : lowercase, split non-alphanum, filtre stopwords/courts."""
    text = text.lower()
    # remplace apostrophes par espaces (l'or → l or)
    text = text.replace("'", " ").replace("'", " ")
    tokens = re.findall(r"[a-zA-Zàâäéèêëïîôöùûüÿçñ0-9]+", text, flags=re.IGNORECASE)
    return [t for t in tokens if len(t) > 1 and t not in STOPWORDS]


def _parse_frontmatter(md: str) -> tuple[dict, str]:
    """Retourne (frontmatter_dict, rest_of_markdown)."""
    m = FRONTMATTER.match(md)
    if not m:
        return {}, md
    raw = m.group(1)
    # parse YAML ultra-léger : on extrait juste en dict à plat pour ce qu'on en fait,
    # sinon l'utilisateur peut regarder config.json qui est la vraie source autoritaire.
    data: dict = {}
    for line in raw.splitlines():
        if ":" in line and not line.startswith(" "):
            key, _, val = line.partition(":")
            data[key.strip()] = val.strip().strip('"').strip("'")
    return data, md[m.end():]


def _split_into_chunks(product_id: str, md_body: str) -> tuple[list[Chunk], str]:
    """
    Découpe le body (sans frontmatter) en chunks selon les marqueurs
    `<!-- section:xxx -->`. Chaque chunk = tout le texte jusqu'au marqueur suivant.

    Retourne (chunks, summary_text) — où summary_text est le contenu de la section
    "summary" si elle existe (utile pour l'overlay prompt).
    """
    chunks: list[Chunk] = []
    summary_text = ""

    # On split par le marqueur. La regex split garde les groupes, donc on alterne
    # [texte_avant, section_name, texte_après_etc.]
    parts = SECTION_MARKER.split(md_body)
    # parts[0] = préambule (avant tout marqueur) — on l'ignore sauf s'il a du contenu
    # Ensuite alternance: [section_name_0, content_0, section_name_1, content_1, ...]

    preamble = parts[0].strip() if parts else ""
    if preamble:
        # On le met en chunk "intro"
        title = _first_header(preamble)
        chunks.append(Chunk(
            product_id=product_id,
            section="intro",
            title=title,
            text=preamble,
            tokens=_tokenize(preamble),
        ))

    # Marcher par paires (section_name, content)
    i = 1
    while i < len(parts):
        section_name = parts[i]
        # Note: le content associé est ce qui PRÉCÈDE le marqueur (convention Markdown).
        # Or avec re.split, parts[i-1] est le content qui précédait — déjà consommé.
        # Convention choisie : le marqueur <!-- section:X --> ferme la section X ;
        # le contenu est donc celui entre le marqueur précédent et ce marqueur.
        # Dans nos MD, on a écrit : contenu de la section\n\n<!-- section:X -->
        # Donc parts[i-1] (déjà traité dans l'itération précédente) EST le bon contenu,
        # mais il est anonyme.
        # Simplification : on ré-assemble proprement en relisant dans l'ordre.
        i += 1

    # Re-implémentation propre : on scan le MD ligne par ligne et on accumule
    # jusqu'à rencontrer un marqueur qui FERME la section en cours.
    chunks = []  # reset
    current_lines: list[str] = []
    preamble_lines: list[str] = []
    seen_first_marker = False

    for line in md_body.splitlines():
        marker_match = SECTION_MARKER.search(line)
        if marker_match:
            section_name = marker_match.group(1)
            content = "\n".join(current_lines).strip()
            if content:
                title = _first_header(content)
                chunk = Chunk(
                    product_id=product_id,
                    section=section_name,
                    title=title,
                    text=content,
                    tokens=_tokenize(content),
                )
                chunks.append(chunk)
                if section_name == "summary":
                    summary_text = content
            current_lines = []
            seen_first_marker = True
        else:
            if not seen_first_marker:
                preamble_lines.append(line)
            else:
                current_lines.append(line)

    # Préambule (avant le premier marqueur) = souvent hook + promise
    if preamble_lines:
        preamble = "\n".join(preamble_lines).strip()
        if preamble:
            title = _first_header(preamble)
            chunks.insert(0, Chunk(
                product_id=product_id,
                section="preamble",
                title=title,
                text=preamble,
                tokens=_tokenize(preamble),
            ))

    # Résidu final (après le dernier marqueur) — rare mais possible
    if current_lines:
        residue = "\n".join(current_lines).strip()
        if residue:
            title = _first_header(residue)
            chunks.append(Chunk(
                product_id=product_id,
                section="trailing",
                title=title,
                text=residue,
                tokens=_tokenize(residue),
            ))

    return chunks, summary_text


def _first_header(text: str) -> str | None:
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#"):
            return line.lstrip("#").strip()
    return None


# ---------- chargement principal --------------------------------------------

class ProductsRegistry:
    """Registre global des produits + recherche BM25."""

    def __init__(self) -> None:
        self.products: dict[str, Product] = {}
        self.catalog: dict = {}

    def load(self) -> None:
        """Charge tout depuis le disque. Idempotent — peut être rappelé pour reload."""
        if not CATALOG_PATH.exists():
            log.warning("No catalog.json found at %s", CATALOG_PATH)
            return

        with CATALOG_PATH.open("r", encoding="utf-8") as f:
            self.catalog = json.load(f)

        for entry in self.catalog.get("products", []):
            if entry.get("status") != "READY":
                continue
            product = self._load_product(entry)
            if product:
                self.products[product.product_id] = product
                log.info(
                    "Loaded product %s: %d chunks, sections=%s",
                    product.product_id,
                    len(product.chunks),
                    sorted({c.section for c in product.chunks}),
                )

    def _load_product(self, entry: dict) -> Product | None:
        product_id = entry["product_id"]
        product_dir = PRODUCTS_DIR / product_id
        if not product_dir.exists():
            log.warning("Product dir missing: %s", product_dir)
            return None

        # config.json
        config_path = product_dir / "config.json"
        if config_path.exists():
            with config_path.open("r", encoding="utf-8") as f:
                config = json.load(f)
        else:
            config = {}

        # images.json
        images_path = product_dir / "images.json"
        if images_path.exists():
            with images_path.open("r", encoding="utf-8") as f:
                images = json.load(f)
        else:
            images = {}

        # sales_letter.md
        md_path = product_dir / "sales_letter.md"
        if not md_path.exists():
            log.warning("No sales_letter.md for %s", product_id)
            return None
        md = md_path.read_text(encoding="utf-8")

        frontmatter, body = _parse_frontmatter(md)
        chunks, summary_text = _split_into_chunks(product_id, body)

        # BM25 index (fallback et scoring lexical)
        bm25 = None
        if chunks:
            tokenized_corpus = [c.tokens for c in chunks]
            non_empty = [toks for toks in tokenized_corpus if toks]
            if non_empty:
                bm25 = BM25Okapi(tokenized_corpus)

        # Embeddings dense (RETRIEVAL_DOCUMENT).
        # gemini-embedding-2 : 8192 tokens context -> plus de troncature dure.
        # Pour v1 : on garde max 2000 chars par securite.
        chunks_matrix = None
        if USE_EMBEDDINGS and chunks:
            max_chars = 6000 if _is_v2_model() else 2000
            items = []
            for c in chunks:
                # Title hint : pour v2, le format "title: X | text: Y" ameliore
                # le recall. On compose le title = section + title si dispo.
                title_hint = c.section
                if c.title:
                    title_hint = f"{c.section} — {c.title}"
                items.append((c.text[:max_chars], title_hint))
            vecs = _embed_batch(items, "RETRIEVAL_DOCUMENT")
            valid_vecs = [v for v in vecs if v is not None]
            if valid_vecs and len(valid_vecs) == len(chunks):
                for chunk, vec in zip(chunks, vecs):
                    chunk.embedding = vec
                chunks_matrix = np.vstack(valid_vecs)
                log.info("Embeddings OK for %s: %d chunks, model=%s, dim=%d",
                         product_id, len(chunks), EMBEDDING_MODEL, chunks_matrix.shape[1])
            else:
                log.warning("Embeddings partial/failed for %s (got %d/%d valid), fallback BM25",
                            product_id, len(valid_vecs), len(chunks))

        return Product(
            product_id=product_id,
            slug=entry.get("slug", product_id),
            product_name=entry.get("product_name", config.get("product_name", product_id)),
            vertical=entry.get("vertical", config.get("vertical", "")),
            expert=entry.get("expert", ""),
            config=config,
            images=images,
            frontmatter=frontmatter,
            chunks=chunks,
            bm25=bm25,
            chunks_matrix=chunks_matrix,
            summary_section=summary_text,
            full_markdown=body,
        )

    # ---- API publique -------------------------------------------------------

    def get(self, product_id: str) -> Product | None:
        return self.products.get(product_id)

    def list_ready(self) -> list[str]:
        return list(self.products.keys())

    def search(self, product_id: str, query: str, k: int = 2) -> list[Chunk]:
        """
        Retourne les k chunks les plus pertinents. Strategie hybride :
          1. Si embeddings dispo : semantic search (cosine similarity).
          2. Sinon : fallback BM25 (match lexical).
        Dans les deux cas on applique le re-ranking par boost de section.
        """
        product = self.products.get(product_id)
        if not product or not query.strip():
            return []

        # === VOIE 1 : Semantic search (embeddings) ===
        if USE_EMBEDDINGS and product.chunks_matrix is not None and product.chunks_matrix.size > 0:
            query_tuple = _embed_query_cached(query)
            if query_tuple is not None:
                query_vec = np.asarray(query_tuple, dtype=np.float32)
                # Top-k sur tous les chunks + extension pour laisser de la marge au re-ranking
                raw_top = _cosine_top_k(query_vec, product.chunks_matrix, min(len(product.chunks), k * 3))
                boosts = _section_boosts_for_query(query)
                adjusted = []
                for idx, score in raw_top:
                    if score <= 0.1:  # similarité trop faible → skip
                        continue
                    section = product.chunks[idx].section
                    factor = boosts.get(section, 1.0)
                    if section in ("intro", "preamble") and factor == 1.0:
                        factor = 0.85
                    adjusted.append((idx, score * factor))
                adjusted.sort(key=lambda x: x[1], reverse=True)
                if adjusted:
                    return [product.chunks[idx] for idx, _ in adjusted[:k]]
            # Si embed failed, on tombe dans le fallback BM25 ci-dessous.

        # === VOIE 2 : BM25 fallback ===
        if not product.bm25:
            return []

        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        scores = product.bm25.get_scores(query_tokens)

        # Boost/penalty par section selon la nature de la query
        boosts = _section_boosts_for_query(query)
        adjusted = []
        for idx, score in enumerate(scores):
            if score <= 0:
                continue
            section = product.chunks[idx].section
            factor = boosts.get(section, 1.0)
            # Pénalité générique sur intro/preamble (matchent trop souvent par nom de produit)
            if section in ("intro", "preamble") and factor == 1.0:
                factor = 0.75
            adjusted.append((idx, score * factor))

        ranked = sorted(adjusted, key=lambda x: x[1], reverse=True)
        return [product.chunks[idx] for idx, _ in ranked[:k]]


# Mots-clés → boost sur certaines sections (re-ranking léger, pas d'embedding)
_NUMERIC_HINTS = re.compile(r"(\+?\d{1,3}[\s\u00a0]?(?:\d{3})+|\d+[.,]\d+|\d+\s*%|x\s*\d+|%)", re.IGNORECASE)
_OBJECTION_HINTS = re.compile(r"\b(cher|prix|co[uû]t|risque|arnaque|confiance)\b", re.IGNORECASE)
_GUARANTEE_HINTS = re.compile(r"\b(garantie|rembours\w*|satisfait|engagement)\b", re.IGNORECASE)
_EXPERT_HINTS = re.compile(r"\b(expert|exp[ée]rience|r[ée]f[ée]rence|cr[ée]dentials?|parcours)\b", re.IGNORECASE)


def _section_boosts_for_query(query: str) -> dict[str, float]:
    """
    Retourne un multiplicateur par section selon la query.
    1.0 = neutre. >1 = boost. <1 = pénalité.
    """
    q = query.lower()
    boosts: dict[str, float] = {}
    if _NUMERIC_HINTS.search(query):
        for s in ("proof", "numbers", "track_record", "performance", "simulated_performance"):
            boosts[s] = 1.6
    if _OBJECTION_HINTS.search(q):
        for s in ("objections", "offer", "pricing", "guarantee"):
            boosts[s] = 1.5
    if _GUARANTEE_HINTS.search(q):
        boosts["guarantee"] = 1.8
    if _EXPERT_HINTS.search(q):
        for s in ("authority", "expert", "bio"):
            boosts[s] = 1.5
    if "opportunit" in q or "maintenant" in q or "urgence" in q:
        for s in ("hook", "opportunity", "urgency"):
            boosts[s] = 1.4
    return boosts


# Singleton global
REGISTRY = ProductsRegistry()


def init() -> ProductsRegistry:
    """À appeler au démarrage du serveur."""
    REGISTRY.load()
    return REGISTRY


# ---- CLI test ---------------------------------------------------------------

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    reg = init()
    print(f"\n=== {len(reg.products)} products loaded ===\n")
    for pid, p in reg.products.items():
        sections = sorted({c.section for c in p.chunks})
        print(f"  {pid:16s} | {len(p.chunks):2d} chunks | expert={p.expert} | sections={sections}")

    if len(sys.argv) >= 3:
        pid = sys.argv[1]
        query = " ".join(sys.argv[2:])
        print(f"\n=== Search in {pid}: '{query}' ===\n")
        for i, chunk in enumerate(reg.search(pid, query, k=5), 1):
            preview = chunk.text.replace("\n", " ")[:200]
            print(f"[{i}] section={chunk.section} title={chunk.title!r}")
            print(f"    {preview}...")
            print()
