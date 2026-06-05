# Standalone Agents — backend séparé

Backend **indépendant** pour les deux widgets autonomes :

- **Assistant Argo** — landing "La Monnaie de l'IA" (texte + vocal)
- **Assistant Héritage** — landing "Trinity Sphères" (vocal)

Séparé du projet **Argos Concierge** (`argo-editions`) pour éviter tout conflit
d'architecture. On peut casser/déployer celui-ci sans jamais toucher l'autre.

## Sécurité (proxy)

La clé Gemini **et** les prompts système restent **côté serveur**. Le navigateur :
- ouvre un WebSocket vers `/api/live` (notre serveur, sans clé) → le serveur relaie vers Gemini
- poste le chat texte sur `/api/text` → le serveur appelle Gemini avec la clé
- ne voit jamais la clé ni le prompt dans l'inspecteur (Network/WS frames)

## Endpoints

| Route | Rôle |
|---|---|
| `GET /api/health` | ping (statut, agents, clé configurée ?) |
| `GET /api/live?agent=<x>` | proxy WebSocket Gemini Live (voix) |
| `POST /api/text?agent=<x>` | proxy HTTP generateContent (chat texte) |
| `POST /api/save-conversation` | sauvegarde transcript dans Supabase |
| `GET /<fichier>` | sert les widgets JS + le mascot |

`agent` ∈ `assistant-argo`, `assistant-heritage`, `raw` (= sans prompt, pour l'analyse de page).

## Déploiement Railway (service séparé, même repo)

1. **Railway → New Service → Deploy from GitHub repo** → choisis ce repo.
2. **Settings → Root Directory** : mets `standalone-agents`
   (c'est ce qui sépare ce service du backend Argos Concierge à la racine).
3. **Variables** (Settings → Variables) :
   ```
   GEMINI_API_KEY=<ta_clé_gemini>
   MISE_PYTHON_GITHUB_ATTESTATIONS=false
   ```
   (SUPABASE_URL / SUPABASE_KEY ont des valeurs par défaut dans le code ;
   surcharge-les si tu veux une autre base.)
4. **Deploy**. Récupère l'URL publique générée (ex:
   `https://standalone-agents-production.up.railway.app`).
5. Vérifie : `curl https://<ton-url>/api/health` → doit répondre
   `{"status":"ok", ..., "gemini_key_set": true}`.

## Intégration sur les landing pages

Les widgets **dérivent automatiquement** l'URL backend de l'endroit d'où le
`<script>` est chargé. Donc il suffit de pointer le `<script src>` vers ce
nouveau backend :

**Page "La Monnaie de l'IA" :**
```html
<script src="https://<ton-url>/assistant-argo-widget.js"></script>
```

**Page "Trinity Sphères" :**
```html
<script src="https://<ton-url>/assistant-heritage-widget.js"></script>
```

(Optionnel : forcer l'URL via `data-backend-url="https://<ton-url>"` sur le tag.)

## Local

```bash
cd standalone-agents
cp ../.env .env          # doit contenir GEMINI_API_KEY=...
pip install -r requirements.txt
python server.py         # écoute sur PORT (def 8000)
```
