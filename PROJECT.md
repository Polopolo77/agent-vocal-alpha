# Argos — Concierge IA vocal d'Argo Éditions

> Document de transmission complet pour reprendre le projet. Lisez-le avant toute modification.

**Repo** : https://github.com/Polopolo77/agent-vocal-alpha
**Prod** : https://web-production-572b6.up.railway.app (Railway auto-deploy sur push `main`)
**Stack** : Python 3.11 + aiohttp / Vanilla JS / Gemini Live API

---

## 1. Contexte du projet

**Argo Éditions** est un éditeur français de publications d'investissement (gestion de patrimoine, bourse, matières premières). 4 publications actives, chacune avec son expert et son angle.

**Argos** est le concierge IA vocal qui accueille les prospects sur le site, diagnose leur profil en conversation naturelle (vocal, pas textuel), et recommande LA publication adaptée. Il remplace un sales humain pour la qualification initiale.

**Public cible** : homme 55-75 ans, patrimoine 50 000€ – 500 000€. Déjà échaudé par banquiers/CGP, naturellement méfiant. Préfère une voix posée, autoritaire, non-vendeuse.

**Objectif commercial** : convertir le visiteur en abonné (149€ à 1997€/an selon produit + tier).

**Philosophie agent** : style Jordan Belfort *le closer, pas l'escroc*. Crée du désir, de l'urgence, de la confiance. Ne ment JAMAIS (chiffres whitelistés depuis la lettre de vente).

---

## 2. Stack technique

### Backend — Python 3.11
| Composant | Rôle | Version |
|---|---|---|
| `aiohttp` | Serveur web async + WebSocket | >= 3.9 |
| `google-genai` | SDK Gemini (Live + embedding) | >= 1.0 |
| `rank-bm25` | Fallback RAG lexical | >= 0.2.2 |
| `numpy` | Cosine similarity embeddings | (installé via stack) |
| `sqlite3` | Persistance transcripts (WAL) | stdlib |
| `python-dotenv` | Chargement `.env` local | >= 1.0 |

### Frontend — Vanilla JS, zéro framework
- HTML/CSS/JS single-file (`frontend/argo-page/index.html`) ~4300 lignes
- Fonts : Cormorant Garamond (serif italique) + Inter + JetBrains Mono
- SVG orb animé avec Canvas 2D pour particules
- WebSocket direct vers Gemini Live (API key côté client via `/api/token`)
- AudioWorklet (downsample 48k → 16k mic)

### Modèles Gemini utilisés
| Rôle | Modèle | Pourquoi |
|---|---|---|
| **Voix Argos (audio bidirectionnel)** | `gemini-3.1-flash-live-preview` (voix `Charon`) | Native audio, latence <500ms |
| **Coach** (analyse conv → produit + chaleur + tier) | `gemini-2.5-flash-lite` (thinking off) | JSON rapide, pas cher |
| **Dossier** (extrait infos prospect) | `gemini-2.5-flash` (thinking 128) | Flash-lite hallucinait |
| **Cards** (choix carte visuelle) | `gemini-3.0-flash` (thinking 256) | Routing thématique fin |
| **RAG embeddings** | `gemini-embedding-2` @ 768 dim | Multimodal, 8192 tokens, +5pts MTEB |

### Déploiement
- **Railway** — auto-deploy sur push `main` (~90s)
- `Procfile` : `web: python server.py`
- `runtime.txt` : `python-3.11.9`
- **Variable d'env unique** : `GEMINI_API_KEY`
- URL finale : `https://web-production-572b6.up.railway.app/argo-page/`

---

## 3. Structure du repo

```
agent vocal/
├── server.py                 # Backend aiohttp (1014 lignes) — endpoints + middlewares
├── products_loader.py        # Chargement produits + RAG embeddings (603 lignes)
├── prompts.py                # Tous les prompts (agent, coach, dossier, cards) (1278 lignes)
├── requirements.txt
├── Procfile
├── runtime.txt
├── .env                      # GEMINI_API_KEY (non-versionné)
├── conversations.db          # SQLite transcripts (WAL)
├── products/
│   ├── catalog.json          # Liste des 4 produits READY
│   ├── argo_actions/
│   │   ├── config.json       # Prix, offres, checkout URLs, current_pitch, lead_expert
│   │   ├── sales_letter.md   # Lettre de vente chunks via <!-- section:xxx -->
│   │   └── images.json       # Cartes visuelles (usage_card → URL CDN)
│   ├── argo_crypto/
│   ├── argo_alpha/
│   └── argo_gold/
└── frontend/
    └── argo-page/
        └── index.html        # Page principale (4326 lignes, tout intégré)
```

---

## 4. Les 4 produits

| product_id | Nom | Expert | Lead magnet | Tiers | Angle |
|---|---|---|---|---|---|
| `argo_actions` | Actions Gagnantes | Whitney Tilson | Bouclier Suisse | A=149€/an, B=299€/an | Value investing US, protection épargne |
| `argo_crypto` | Profits Asymétriques | Eric Wade | La Fin du Travail | A=129€/an, B=299€/an | Crypto + tech asymétrique, 4e Révolution Industrielle |
| `argo_alpha` | Agent Alpha | Whitney Tilson (superviseur) + Stansberry | — | A=496€/an, B=997€/an, C=149€/trim, D=299€/trim | IA quantitative, 20 actions Russell 1000 |
| `argo_gold` | Stratégie Haut Rendement | Dan Ferris | Hyper Climax Gold | A=997€/an, B=1997€/an, C=299€/trim, D=599€/trim | Or / minières / uranium |

Chaque `config.json` contient :
- `product_name`, `vertical`, `positioning`
- `lead_expert` : nom, credentials, notable_wins (chiffres autorisés)
- `offers` : prix + label + `checkout_url` par tier (URL Atlas avec tracking Polaris)
- `current_pitch` : { hook, thesis, opportunity } — **injecté directement dans le system prompt**
- `attack_angles`, `guarantees`, `cadence`, etc.

---

## 5. Architecture conversationnelle

### Flow global d'un appel

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│   Browser    │────│  Gemini Live WS  │    │   Backend    │
│  (index.html)│    │  (Charon voice)  │    │  aiohttp     │
└──────┬───────┘    └──────────┬───────┘    └──────┬───────┘
       │                       │                    │
       │  audio PCM16 16k      │                    │
       │──────────────────────▶│                    │
       │                       │                    │
       │  audio PCM24 24k      │                    │
       │◀──────────────────────│                    │
       │                       │                    │
       │  input/output         │                    │
       │  transcription        │                    │
       │◀──────────────────────│                    │
       │                       │                    │
       │  toolCall: obtenir_briefing                │
       │◀──────────────────────│                    │
       │  ─── fetch /api/briefing ─────────────────▶│
       │  ◀─── RAG response ────────────────────────│
       │  toolResponse         │                    │
       │──────────────────────▶│                    │
       │                       │                    │
       │   fetch /api/strategist (coach)            │
       │─────────────────────────────────────────  ▶│
       │   fetch /api/ui-dossier (extract info)     │
       │─────────────────────────────────────────  ▶│
       │   fetch /api/ui-cards (pick visual)        │
       │─────────────────────────────────────────  ▶│
```

### Les 4 agents en parallèle

**1. Argos (Gemini Live) — voix principale**
- Voix : `Charon` (posée, autoritaire)
- System prompt : 35k chars, compilé au boot (`CACHED_PROMPT`)
- Tool : `obtenir_briefing(raison)` — recherche sémantique dans les lettres de vente
- Gère 7 phases de conversation (hook → diagnostic → teaser → récap → révélation expert → opportunité concrète → prix)

**2. Coach — `POST /api/strategist`**
- Modèle : `gemini-2.5-flash-lite`, JSON output
- Appelé à **tous les tours ≥ 3** (throttle 5s)
- Analyse : DISC, chaleur (froid/tiede/chaud/pret_a_acheter), archétype, produit recommandé + tier, objections, signal closing
- Cache : `coach_cache[session_id]` TTL 30 min

**3. Dossier — `POST /api/ui-dossier`**
- Modèle : `gemini-2.5-flash` (upgrade depuis flash-lite qui hallucinait)
- `thinking_budget: 128`, `temperature: 0.05` (ultra conservateur)
- Extrait : prenom, situation, objectif, horizon, capital, profil_detecte, vigilance, signaux_non_verbaux
- Règle stricte : **citation littérale obligatoire** pour chaque item (anti-hallucination)

**4. Cards — `POST /api/ui-cards`**
- Modèle : `gemini-3.0-flash` (upgrade depuis flash)
- `thinking_budget: 256`, `temperature: 0.45` (plus créatif pour varier les choix)
- Contexte riche : dossier complet + signaux coach + **historique cartes affichées session** (`_cards_session_history`)
- Verrous serveur :
  - Cross-produit (rejette cartes d'un autre produit si `active_product` set)
  - Anti-répétition (rejette clé déjà dans l'historique session)
- Few-shot examples dans le prompt pour routing thématique

---

## 6. Système RAG (Retrieval Augmented Generation)

### Chunking
- Lettres de vente en Markdown avec marqueurs `<!-- section:xxx -->`
- Sections typiques : `accroche`, `promise`, `problem`, `solution`, `proof`, `authority`, `offer`, `guarantee`, `testimonial`, `opportunity`, `urgency`, `summary`, `signature`, etc.
- Chunk = une section entière (pas de split sub-section)

### Embedding — `gemini-embedding-2` (GA avril 2026)
- **Dim** : 768 (MRL, dimension recommandée)
- **Context** : 8192 tokens (4× plus que embedding-001)
- **Format v2** : task_type inclus dans le prompt
  - Docs : `"title: {section} — {title} | text: {content}"`
  - Queries : `"task: search result | query: {user_query}"`
- **Batch v2** = 1 vecteur agrégé → on boucle via `ThreadPoolExecutor(max_workers=6)` au boot
- **Boot** : ~7.5s (4 produits × ~20 chunks = 77 chunks total)
- **Query** : 300-700ms 1ère fois, ~0ms via `@lru_cache(maxsize=512)`
- **Fallback BM25** si API plante ou échec

### Search hybride
1. **Voie sémantique** : cosine similarity numpy sur `chunks_matrix (N, 768)`
2. **Re-ranking par section** : boost `proof/numbers/track_record` sur queries numériques, pénalité `intro/preamble` (matches triviaux)
3. **Fallback BM25** si embeddings indisponibles

### Réponse briefing enrichie
```json
{
  "query": "...",
  "coach": { "profil_prospect", "chaleur", "produit_recommande", "tier", ... },
  "sources": [ { "section", "title", "excerpt (250 chars)" } ],  // BM25/sémantique
  "allowed_numbers": ["+548%", "x475", "+8 900%", ...],  // whitelist stricte
  "produit_cible": { "nom", "expert", "lead_magnet", ... },
  "opportunity": {   // nouveau : current_pitch direct
    "hook": "...",
    "thesis": "...",
    "concrete_angle": "La stratégie CASH EXIT vers la Suisse...",
    "instruction": "Cite cette opportunité quand..."
  }
}
```

---

## 7. Les 7 phases de conversation

Réglées dans `prompts.py` (`BASE_AGENT_PROMPT`) :

| Phase | Tours | Action |
|---|---|---|
| **1. Hook** | 1 | "Bonjour, ici Argos... puis-je vous demander votre prénom ?" |
| **2. Diagnostic** | 2-5 | Situation, expérience, objectif, horizon, **BUDGET** (critique) |
| **3. Teaser** | 4-5 | "Ce que vous me décrivez me fait penser à quelque chose qui vient de tomber..." |
| **4. Récap + pont** | 5-6 | Miroir Voss + confirmation |
| **5. Révélation expert** | 6-7 | Nom de l'expert + 2-3 credentials |
| **6. Opportunité concrète** | 7-9 | 6a (pourquoi maintenant) → 6b (service) → 6c (preuves) → 6d (bonus) |
| **7. Prix comme évidence** | 10+ | Montant + garantie + closing assumptif |

### Règles absolues (top du system prompt)
1. JAMAIS de prix avant 6a+6b+6c
2. 1 phase = 1 message (sauf fusion 6c+6d si chaleur=chaud)
3. 1 seule question par message
4. `obtenir_briefing` AVANT toute citation de chiffre
5. Le mot "type" est interdit (dire "cet expert")
6. **WHITELIST CHIFFRES** : interdit d'inventer un %/multiple
7. **Fin d'appel propre** : "Parfait {prénom}, merci pour ce moment. À très vite."
8. **COHÉRENCE PROFIL → ANGLE** : croissance/sécurité/tech/asymétrie selon mots du prospect
9. **TU NE COMMENCES JAMAIS PAR UN CROCHET** (anti-hallucination markers)
10. **GESTION INTERRUPTIONS** : si coupé, ne jamais reprendre la phrase, réponds au dernier message

### Choix du tier selon capital
- <10k€ → tier A
- 10-50k€ → A (sauf signal "premium")
- **>50k€ → tier B par défaut** (pas A)
- Hésitation / "tester" → tier C trimestriel

---

## 8. Les cartes visuelles (Smart Cards)

### Templates disponibles (via `buildSmartCard()`)

**Vente classique** :
- `proof_number` : gros chiffre doré (ex "+548%", "x475")
- `expert_portrait` : photo + credentials
- `opportunity` : teaser mystère
- `comparison` : blocs contrastés (livret A vs Argo)
- `testimonial` : citation abonné
- `track_record` : tableau perfs
- `offer_card` : récap produit + prix + CTA
- `guarantee_generic` : rassurance

**Phase diagnostic (ajouts récents)** :
- `welcome_steps` : 3 étapes d'accueil (T1)
- `rgpd_notice` : transparence (T1+4s)
- `live_market` : CAC/Or/BTC/EUR-USD (T1+9s via `/api/market`)
- `did_you_know` : fait neutre (banque de 5 facts)
- `patrimony_chart` : donut 70/15/8/7 SVG
- `glossary` : définition d'un mot technique (PEA, ETF, dividende, volatilité...)
- `no_commit` : rassurance sur hésitation
- `analysis_cross` : moment de révélation dramatique ("Analyse en cours...")

### Triggers
- **Locaux** : `LOCAL_CARD_TRIGGERS[]` — mot-clé dans la parole d'Argos → carte immédiate (bindés au produit : `product: "argo_actions"` filtre par active_product)
- **LLM cards agent** : appelé pendant la parole (throttle 4s) + à turnComplete+400ms + à turnComplete+2200ms
- **Intro scheduled** : welcome_steps @600ms, rgpd_notice @4s, live_market @9s
- **Hesitation** : no_commit sur "je sais pas" / "pas sûr" / "j'hésite"
- **Reveal** : `analysis_cross` quand coach passe `certitude: ferme` (1 fois par conv)

### Anti-répétition
- `localCardShown` Set côté client (jamais 2× la même clé)
- `_cards_session_history[session_id]` côté serveur (max 20, rejette en amont)
- Stack max **2 cartes** visibles, FIFO pur (la plus ancienne dégage instantanément)
- Lifespan 12s pour les cartes non-offre

### Intent d'achat explicite
L'overlay plein écran (Actions Gagnantes / 149€ / bouton S'INSCRIRE) ne se déclenche PLUS sur `signal_closing: vert` (trop tôt). Il se déclenche sur **intention explicite** :
- Prospect dit "ok je m'inscris", "je prends", "c'est bon", "on y va"
- Argos dit "vous voyez le bouton qui vient d'apparaître", "cliquez sur S'inscrire"

---

## 9. UI / Design

### Layout (3 colonnes)
```
┌──────────────┬─────────────────────────┬──────────────┐
│              │         NAV bar         │              │
│              ├─────────────────────────┤              │
│ Témoignage   │      Orb (SVG Oracle)   │   Dossier    │
│ Henri L.     │      ↓                  │   (card)     │
│              │      L'Oracle           │              │
│ ↓ fade       │      de votre patri...  │              │
│ en appel     │      [Démarrer]         │              │
│              │      Status             │              │
│ Cards slot   │      Transcript         │              │
│ en appel     │      Tuto 3 étapes      │              │
└──────────────┴─────────────────────────┴──────────────┘
```

### Orb Oracle (SVG pur, pas React)
- 3 couches : heat-halo (gradient radial couleur chaleur) + rings rotatifs + core pulsant + particules canvas
- Anneau externe (40s rotation + 12 ticks)
- Anneau moyen contre-rotatif avec texte circulaire "ARGOS · CONCIERGE PATRIMONIAL · ARGO ÉDITIONS"
- Sphère centrale avec gradient + méridiennes + cœur doré
- Waveform 64 bars (amplitude réelle depuis `AnalyserNode`)
- Particules dorées canvas 2D (émission pendant parole)
- Pedestal avec "A · R · G · O · S"
- Réactif au voice RMS via CSS var `--orb-scale`

### Dossier à droite
- Template à trous par défaut (Prénom ____, Situation ____, etc.)
- Se remplit dynamiquement via `renderDossier()` sur chaque callback de `/api/ui-dossier`
- Anti-hallucination : règle "TEST ULTIME — peux-tu citer mot pour mot ?"
- Progress bar + compteur % complété
- Animation glow sur nouveaux items

### Chaleur → couleur
- `froid` → bleu acier (#6688aa)
- `tiede` → or cuivré (#b89441)
- `chaud` → or pur (#d4a030)
- `pret_a_acheter` → or lumineux pulsé (#d4b45a)
Applique sur : 4 pips meter, heat halo, viewport glow border, anneau.

---

## 10. Endpoints backend détaillés

| Méthode + Route | Usage | Détails |
|---|---|---|
| `GET /api/products` | Liste produits + cartes | Public, utilisé au bootstrap |
| `POST /api/token` | Clé Gemini Live | Rate limit 20/h/IP |
| `POST /api/session` | Session_id signé serveur | Anti-spoofing coach_cache |
| `GET /api/prompt` | System instruction | Cached au boot (`CACHED_PROMPT`) |
| `POST /api/strategist` | Coach | Rate 200/h, max_tokens 2048 |
| `POST /api/ui-dossier` | Extraction dossier | Rate 300/h, flash + thinking 128 |
| `POST /api/ui-cards` | Pick carte | Rate 300/h, flash 3.0 + thinking 256 |
| `POST /api/briefing` | RAG sémantique | Rate 300/h, sources + opportunity |
| `POST /api/save-conversation` | SQLite persist | Rate 60/h, 512KB max |
| `GET /api/conversations` | Admin view | Pas sécurisé (ajouter auth) |
| `GET /api/market` | CAC 40, or, BTC, EUR/USD | Cache 10min, Yahoo + CoinGecko |
| `GET /{path}` | Static files | Path traversal hardened |

### Sécurité serveur
- **Rate limiting** par IP/endpoint (in-memory deque)
- **CORS** permissif (widget embeddable)
- **Headers** : `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, CSP complète (autorise `blob:` pour AudioWorklet)
- **HSTS** si `X-Forwarded-Proto: https`
- **Validation payload** : max 200 messages × 4000 chars, 512KB total
- **SQLite WAL** + timeout 5s
- **Path traversal** : `file_path.relative_to(FRONTEND_DIR)` après resolve
- **Cleanup task** toutes les 5 min (coach_cache TTL 30min, sessions TTL 4h, rate buckets)

---

## 11. Lessons learned / Pièges connus

### ❌ Injections de contexte textuel qui vocalisent
Gemini Live parfois vocalise le contenu envoyé via `realtimeInput.text` ou `clientContent.turnComplete:false` comme s'il s'agissait d'une continuation audio. **Argos a lu `[COACH NOTIFICATION]` à voix haute** dans une vraie conversation avec un utilisateur.

**Conséquence** : toutes les injections bracket-marquées supprimées :
- ~~`injectProductBriefing`~~ (retirée)
- ~~`nudgeToClosingMode` `[SWITCH MODE CLOSING]`~~ (retirée)
- ~~`triggerProductReveal` directive~~ (retirée, carte visuelle gardée)
- ~~P8 remembered dossier hint~~ (retirée)
- ~~Silence after price `STOP...`~~ (retirée)
- ~~Pattern interrupt 45s~~ (retirée)
- ~~Barge-in nudge `[INTERRUPTION...]`~~ (retirée)

**Solution adoptée** : tout dans le system prompt + règles fortes + `obtenir_briefing` tool pour les lookups dynamiques. Le tool response est SAFE (pas vocalisé verbatim).

**Note recherche** : Le seul pattern officiellement silencieux est `scheduling: "SILENT"` sur `FunctionResponse`, mais il nécessite un `FunctionCall` préalable de Gemini. Pas utilisable pour de l'auto-push serveur.

### ❌ Règle qui cite les markers en exemple
La règle 9 originale listait `[COACH NOTIFICATION]`, `[BRIEFING PRODUIT]`, `[SYSTEM CONTEXT]` comme "marqueurs à ignorer". Gemini les a APPRIS et les ré-hallucinait en output. **Leçon** : ne jamais citer de patterns qu'on ne veut pas voir en output.

**Fix** : règle 9 reformulée en "Tu ne commences JAMAIS par un crochet. Aucun mot entre crochets ne doit sortir de ta voix."

### ❌ Dossier hallucinait (flash-lite trop faible)
Paul disait "j'ai investi en bourse", le dossier affichait `situation: salarié, vigilance: peur de perdre` — pure invention stéréotypée.

**Fix** :
- Upgrade vers `gemini-2.5-flash` + `thinking_budget: 128`
- 4 exemples concrets d'hallucination en TÊTE du prompt
- Règle "TEST ULTIME : peux-tu citer MOT POUR MOT ?"

### ❌ Cards répétées / s'arrêtaient au 4-5e tour
- LLM ne voyait pas l'historique des cartes affichées → reproposait les mêmes
- Trigger uniquement pendant la parole d'Argos (pas à turnComplete)

**Fix** :
- `_cards_session_history` serveur (20 cartes, rejette répétitions avant envoi client)
- LLM reçoit `shown_cards: [...]` dans son prompt
- Trigger cards à turnComplete + 400ms + 2200ms (3 occasions par tour)
- Upgrade vers `gemini-3.0-flash + thinking 256`

### ❌ Tier A proposé pour 60k€ (gâchis)
Coach défaultait sur tier A même pour gros capital.

**Fix** :
- Règle explicite "Capital > 50k€ → tier B par défaut (pas A)"
- Briefing injecte TOUS les tiers avec positioning
- Argos justifie son choix ("Vu vos 60 000 € je vous propose le premium à 997€")

### ❌ BM25 rate les reformulations orales
"Je veux faire grossir mon argent" → 0 match BM25, mais embeddings trouvent `promise` + `solution` direct.

**Fix** : migration vers `gemini-embedding-2` avec fallback BM25.

### ❌ Bug gate turn 0 sur welcome/rgpd/market
Ma première version de `cardAllowedAtThisTurn` settait `isIntro = true` mais la fonction tombait sur `return turn >= 2` final qui bloquait.

**Fix** : `if (INTRO_TEMPLATES.indexOf(tpl) >= 0) return true` (return immédiat).

### ❌ Quick-replies interactives retirées
5 cartes interactives (expérience, capital, horizon, risque, concerns) qui injectaient la réponse du clic comme si le prospect l'avait dite. Le prospect préfère parler → retirées complètement.

### ❌ Overlay closing plein écran trop tôt
Déclenché sur `signal_closing: vert` → apparaissait dès un "oui" enthousiaste.

**Fix** : ne se déclenche QUE sur intent explicite (user "ok je m'inscris" OU Argos "cliquez sur le bouton").

---

## 12. État actuel (avril 2026)

### ✅ Ce qui fonctionne
- Vocal audio-to-audio Gemini Live bidirectionnel, voix Charon, latence <500ms
- Coach + Dossier + Cards agents en parallèle, avec verrous anti-répétition
- RAG sémantique `gemini-embedding-2` (boot 7.5s, query 300ms → 0ms cached)
- Dossier UI template + rendu dynamique avec anti-hallucination
- Orb SVG Oracle avec waveform + particules + heat halo
- Routing produit par dossier + capital → tier approprié
- Checkout URLs dynamiques par tier dans toutes les CTAs
- Cards intro (welcome, RGPD, live market) + diagnostic (DYK, patrimony, glossary)
- Security : rate limiting, CORS headers, CSP, WAL, cleanup périodique
- Déploiement Railway auto sur push main

### ⚠️ Ce qui reste fragile
- Si Gemini Live tombe momentanément → pas de retry robuste (reconnexion simple 3x)
- Les tokens Gemini sont exposés au client (`/api/token` renvoie la clé brute) — il faudrait proxifier le WS. Non-fait, considéré comme trade-off acceptable pour l'instant.
- Dossier/Coach peuvent occasionnellement renvoyer du JSON invalide → fallback silencieux
- CDN Argo parfois servait la mauvaise image (ex: `perf-lumentum.jpeg` servait le dashboard) → on a retiré les images des cartes `proof_number`, on garde seulement sur `expert_portrait` et `opportunity` (plus fiables)

### ❌ Connu non-résolu
- `inpage.js Origin not allowed` erreurs de wallet crypto (extension navigateur, pas notre code) → ignore
- `favicon.ico 404` → cosmétique, pas impactant

---

## 13. Debugging / Observabilité

### Console navigateur
```
[Argo] Catalog loaded: Array(4) — total cards: 74
[Argo] Prompt pre-fetched: 35455 chars
[Argo] Dossier: {"prenom":"Paul","situation":["investit en bourse"],...}
[Argo] Fetching briefing for injection: argo_actions
[Argo] obtenir_briefing called: c'est quoi l'opportunité du moment
[Argo] briefing returned: sources: 2 | allowed: 8
[Argo] Card filtered (too early): glossary_ turn= 1
[Argo] End-of-call detected: user → auto disconnect dans 3s
[Argo] Buy intent detected: user → show overlay
```

### Logs serveur (Railway)
```
COACH [mid_call] turn=4 archetype=cadre_actif chaleur=tiede produit=argo_alpha tier=B certitude=moyen
UI cards decided: tpl=proof_number key=proof_netflix reasoning=Argos cite +8900% Netflix...
UI cards cross-product rejected: key=authority_ferris owner=argo_gold active=argo_actions
UI cards repetition blocked: key=authority_tilson session=s_xyz
CONV #123 saved | product=argo_actions duration=420s messages=28
Embeddings OK for argo_actions: 22 chunks, model=gemini-embedding-2, dim=768
```

### Inspection en direct (console browser)
```js
// État global
state.currentRecommendedProduct    // argo_actions etc.
state.coachDirective                // dernière directive coach
state.lastDossier                   // dossier courant
state.conversationLog               // historique complet
activeCards                         // cartes visibles
localCardShown                      // Set des clés affichées (anti-répétition local)
```

### Scénarios de test
Voir `Quelques exemples de profils` dans l'historique de la conversation :
1. **Débutant prudent, petit capital** → `argo_actions` tier A
2. **Cadre tech IA gros capital** → `argo_alpha` tier B
3. **Crypto curieux petit budget** → `argo_crypto` tier A
4. **Retraité aisé or/minières** → `argo_gold` tier B
5. **Cadre immobilier moyen budget** → `argo_actions` tier B
6. **Intermédiaire protection** → `argo_actions` tier A
7. **Pressé par automatisation** → `argo_alpha` tier C trim
8. **Abonné existant cross-sell** → `argo_alpha` tier A

---

## 14. Historique des décisions techniques importantes

### Pourquoi Gemini Live et pas OpenAI Realtime ?
- Français natif excellent (CAC, expressions idiomatiques)
- 1M context (pour prompt de 35k chars)
- Prix 3-5× moins cher qu'OpenAI Realtime
- Native audio in/out (pas pipeline STT→LLM→TTS)

### Pourquoi voice = Charon (pas Puck) ?
Cible 55-75 ans. Puck = jeune dynamique. Charon = posé autoritaire, style "expert financier". Charon convertit mieux selon les benchmarks Stansberry (éditeur US).

### Pourquoi coach = flash-lite, pas flash ?
Coach renvoie JSON structuré, pas besoin de raisonnement. Flash-lite = 10× moins cher, idéal pour polling tous les tours.

### Pourquoi dossier = flash et pas flash-lite ?
Flash-lite hallucinait stéréotypes. Flash + thinking 128 = zéro invention, respect strict des règles de citation.

### Pourquoi cards = flash 3.0 et pas flash 2.5 ?
Routing thématique entre 20 cartes × 4 produits avec éviction des répétitions. Flash 2.5 retombait sur les mêmes choix. Flash 3.0 + thinking 256 = raisonne avant de choisir.

### Pourquoi embedding-2 et pas voyage / openai ada ?
- Latence serveur Google < voyage
- Français couvert natif
- Écosystème unique (Live + Embed + Generate sur même API key)
- 8192 tokens context (vs 2048 chez 001) = pas de troncature des chunks

### Pourquoi Railway et pas AWS/GCP ?
- Auto-deploy sur push GitHub (simplicité)
- 1 dyno = largement suffisant (WebSocket streaming côté Gemini)
- Prix prévisible

---

## 15. Checklist pour bootstrap nouvelle conv Claude

Quand tu reprends le projet :

1. **Clone le repo** `git clone https://github.com/Polopolo77/agent-vocal-alpha`
2. **Installe** `pip install -r requirements.txt`
3. **Crée `.env`** avec `GEMINI_API_KEY=ta_clé`
4. **Lance local** `python server.py` → ouvre `http://localhost:8000/argo-page/`
5. **Test une conv** — dis "je m'appelle X", "j'ai investi un peu", "50 000€ à placer"
6. **Vérifie les logs console** : 
   - Dossier se remplit sans hallucination ?
   - `obtenir_briefing called` apparaît-il ?
   - Cards alternent les thèmes ?
   - Argos cite-t-il le `current_pitch` du produit routé ?

### Fichiers à connaître pour modifications fréquentes
- `prompts.py:BASE_AGENT_PROMPT` — règles d'Argos (phases, ton, closing)
- `prompts.py:BASE_COACH_PROMPT_TEMPLATE` — analyse coach, schéma JSON
- `prompts.py:build_catalog_overlay` — comment les 4 produits sont présentés à Argos (catalog + pitches + tiers + chiffres)
- `prompts.py:BASE_UI_CARDS_PROMPT` — règles du cards agent
- `products/<pid>/config.json:current_pitch` — opportunité concrète par produit
- `frontend/argo-page/index.html:LOCAL_CARD_TRIGGERS` — déclencheurs mot-clé → carte
- `frontend/argo-page/index.html:triggerEarlyDiagnosticCard` — flow cards intro

### Endpoints pour debug
- `GET /api/products` — voir catalog chargé
- `GET /api/market` — vérifier market data
- `POST /api/briefing` (via curl) — tester RAG query
- `GET /api/conversations` — 100 dernières conversations SQLite

---

## 16. Roadmap / TODO potentielles

### Court terme (haute valeur, faible effort)
- [ ] A/B test 2 prompts sur phases 6a-6b (pourquoi maintenant vs storytelling abonné)
- [ ] Ajout de cartes `track_record` par produit (tableau 5 perfs)
- [ ] Améliorer la transition diagnostic→closing (moment de bascule plus fluide)
- [ ] Log chaque appel coach + tokens consommés pour suivre le budget

### Moyen terme
- [ ] Remplacer `/api/token` par un WebSocket proxy backend (sécurité clé Gemini)
- [ ] Système d'admin : stats conv réussies vs abandonnées, durée moyenne, tier moyen
- [ ] Ajout langues (anglais, à partir du system prompt traduit)
- [ ] Cross-session mieux géré (LocalStorage P8 actuel basique)

### Long terme (refacto)
- [ ] Téléphonie via LiveKit ou Pipecat (bridge Twilio → Gemini Live)
- [ ] Migration frontend vers Lit ou Preact (index.html fait 4300 lignes, difficile à maintenir)
- [ ] Passage du backend de Railway → Cloud Run / Fly.io (plus de contrôle)
- [ ] Base Postgres au lieu de SQLite (multi-dyno, concurrence)
- [ ] Observabilité OpenTelemetry

### Expériences produit
- [ ] Cartes de mimétisme ("84% de nos abonnés prudents ont choisi Actions Gagnantes")
- [ ] Timer visuel sur l'offre ("cette fenêtre de tir expire dans 7 jours")
- [ ] Mini-video de l'expert qui parle (embed Vidyard déjà dans config)
- [ ] Fonctionnalité "envoyer par mail le dossier récapitulatif" après call

---

## 17. Contexte git (commits récents)

```
01d0b3c Migration gemini-embedding-001 -> gemini-embedding-2 + tool description sémantique
c4739ff Upgrade RAG : BM25 -> embeddings gemini-embedding-001 (768d) avec fallback
d4ad46f Briefing auto enrichi : current_pitch en top priority + tool description forcante
04b895d current_pitch par produit injecté dans le catalog overlay + règle 6a obligatoire
4272bd6 Voix : Puck -> Charon (plus posée et autoritaire, mieux pour la cible 55-75 ans)
54785b3 Argos : supprime TOUTES les injections bracket-marked + règle 9 sans mentionner les marqueurs
b9028cb Overlay closing uniquement sur intent d'achat explicite (plus sur signal vert)
ef29050 Fix hallucination dossier : modèle gemini-2.5-flash + règle anti-halluc en tête
7f061c8 Retire l'injection auto du briefing (Argos le lisait à voix haute)
d2c7d51 Fix gate turn 0 (vraiment) + gestion interruptions propre
ad3bacc Retire quickreplies + fix gate intro cards tour 0 + briefing compact + coach max_tokens
a9a9b42 Audit UI cards : modèle plus smart + contexte riche + mémoire cross-appels + moins de redites
24d3402 Tier selection piloté par le capital + briefing injecte TOUS les tiers
70b21b2 Checkout URLs par tier + routing CTA sur l'URL du tier recommandé par le coach
ca90edf Moment de vérité : reveal dramatique du produit à certitude=ferme
```

---

## 18. Contacts / Refs

**Repo** : https://github.com/Polopolo77/agent-vocal-alpha
**Prod** : https://web-production-572b6.up.railway.app/argo-page/
**Backend API** : https://web-production-572b6.up.railway.app/api/*
**Éditeur** : Argo Éditions (argo-editions.com)
**Checkout** : atlas.argo-editions.com (tracking Polaris)

**Docs Gemini utiles** :
- [Live API](https://ai.google.dev/gemini-api/docs/live-api) (audio bidirectionnel)
- [Live API Tools](https://ai.google.dev/gemini-api/docs/live-api/tools) (function calling + scheduling)
- [Embeddings](https://ai.google.dev/gemini-api/docs/embeddings) (embedding-001, embedding-2)

---

**Dernière mise à jour** : 23 avril 2026
**Principal contributeur** : Paul (Polopolo77) + Claude (pair programming)
