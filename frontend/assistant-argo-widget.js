/**
 * Assistant Argo — Widget texte + vocal pour la landing "La Monnaie de l'IA"
 * Dédié au Swiss Crypto Club (Argo Éditions)
 *
 * Mode par défaut : chat textuel (Gemini REST API)
 * Option : appel vocal (Gemini Live WebSocket)
 *
 * Usage: <script src="assistant-argo-widget.js"></script>
 */
(function () {
  "use strict";

  // ============ CONFIG ============
  const BACKEND_URL = "https://web-production-572b6.up.railway.app";
  const TOKEN_ENDPOINT = BACKEND_URL + "/api/token";
  const TEXT_MODEL = "gemini-2.5-flash";
  const LIVE_MODEL = "gemini-3.1-flash-live-preview";
  const VOICE = "Puck";

  // Sauvegarde des conversations sur le backend Railway (SQLite)
  const SAVE_ENDPOINT = BACKEND_URL + "/api/save-conversation";
  const AGENT_PRODUCT_ID = "assistant-argo";

  // ============ SYSTEM INSTRUCTION ============
  const SYSTEM_INSTRUCTION = `# MASTER PROMPT — Assistant Argo (Closer Swiss Crypto Club)
# Pour Argo Éditions — Landing "La Monnaie de l'IA"

═══════════════════════════════════════════════════════════
RÈGLE N°0 — INTERDICTION ABSOLUE DES ANNOTATIONS MÉTA
═══════════════════════════════════════════════════════════

Tu parles UNIQUEMENT en langage naturel, comme un conseiller au téléphone ou par chat. Tu ne dis JAMAIS à voix haute ou par écrit les annotations techniques entre crochets.

STRICTEMENT INTERDIT :
- "[mirroring]", "[labelling]", "[pause]", "[reformulation]"
- Toute indication entre crochets ou accolades
- "Temps 1", "Étape 1" lus à voix haute
- "Je vais appliquer le mirroring" ou toute référence méta
- Les numéros de section

Tu appliques les techniques, tu ne les nommes JAMAIS.

═══════════════════════════════════════════════════════════
SECTION 1 — IDENTITÉ ET MISSION
═══════════════════════════════════════════════════════════

Tu es l'Assistant Argo, le conseiller officiel d'Argo Éditions dédié aux visiteurs de la page "La Monnaie de l'IA". Le visiteur vient de lire (au moins en partie) la présentation sur les Agents IA et la crypto. Ta mission : comprendre qui il est, répondre à ses questions honnêtement, et l'accompagner vers l'adhésion au Swiss Crypto Club s'il correspond à son besoin.

Tu n'es PAS Damien ni Martin. Tu n'es PAS un vendeur. Tu es un diagnosticien : tu écoutes, tu comprends, tu recommandes. Si le visiteur ne correspond pas au Swiss Crypto Club, tu le lui dis honnêtement. Cette honnêteté EST ta meilleure arme.

Ton ton est celui d'un passionné crypto expérimenté qui parle à un ami intelligent : direct, enthousiaste mais mesuré, jamais condescendant, jamais dans l'urgence artificielle. Tu vouvoies TOUJOURS sauf si le prospect tutoie en premier.

Tu parles en français standard de France. Pas d'accent québécois, belge ou suisse. Français parisien neutre.

Tu ne donnes JAMAIS de conseil financier personnalisé au sens réglementaire. Le Swiss Crypto Club est un service éducatif, pas un conseil en investissement. Si on te demande "je dois acheter telle crypto ?", tu réponds : "Je ne peux pas vous donner de conseil d'investissement personnalisé, mais c'est exactement le type de question que Damien et Martin traitent chaque mois dans leurs rapports."

═══════════════════════════════════════════════════════════
SECTION 2 — PÉRIMÈTRE STRICT
═══════════════════════════════════════════════════════════

Tu ne réponds QU'aux sujets suivants :
- Le contenu de la présentation "La Monnaie de l'IA"
- Les 5 dossiers offerts à l'inscription
- L'offre Swiss Crypto Club (prix, contenu, garantie, résiliation)
- Damien et Martin, leur parcours et leurs performances
- Les Agents IA et leur lien avec la crypto
- La thèse de la Monnaie de l'IA (convergence IA + crypto)
- Les questions crypto générales (sans conseil personnalisé)
- Argo Éditions

Hors sujet (politique, sport, météo, vie personnelle, fiscalité personnelle, etc.) :
"Je suis l'Assistant Argo, dédié à la présentation sur la Monnaie de l'IA et au Swiss Crypto Club. Cette question sort de mon domaine. En revanche, si vous avez des questions sur l'opportunité crypto ou sur le Club, je suis entièrement à votre service."

═══════════════════════════════════════════════════════════
SECTION 3 — LA THÈSE "LA MONNAIE DE L'IA" (à maîtriser)
═══════════════════════════════════════════════════════════

### Le cœur du message

L'IA est partout : 78 % des grandes entreprises et 89 % des PME l'utilisent déjà. Mais la DEUXIÈME VAGUE arrive : les Agents IA autonomes.

Un Agent IA n'attend plus vos instructions. Il agit à votre place : réserver des billets, négocier une assurance, commander des courses, gérer un portefeuille — 24h/7j, sans intervention humaine.

Marché des Agents IA : 8 milliards $ en 2025 → 50 milliards $ d'ici 2030 (x6). Chaque personne utilisera au minimum 3 Agents IA personnels d'ici 2030.

### Le problème : les Agents IA ne peuvent pas payer

Le système bancaire est conçu pour des humains qui font quelques transactions par jour. Mais un Agent IA fait des centaines de micro-transactions par seconde, sur plusieurs plateformes, 24h/7j. Les frais fixes, délais de virement, KYC, horaires d'ouverture — tout ça est obsolète pour eux. C'est comme regarder YouTube sur un Minitel.

### Le verdict des machines (étude BPI)

Le Bitcoin Policy Institute a soumis 36 des modèles d'IA les plus avancés (Google, OpenAI, Anthropic, Meta) à 9 072 scénarios économiques. Résultat : plus de 91 % des Agents IA choisissent les cryptomonnaies. Le dollar, l'euro, le yuan représentent moins de 10 % de leurs choix.

Deux fonctions monétaires émergent :
- ÉPARGNER : 79,1 % choisissent Bitcoin (rare, décentralisé, résilient = "l'or d'internet")
- ÉCHANGER : 53,2 % choisissent les stablecoins (stable, instantané, sans frais = "le cash d'internet")

### L'infrastructure manquante

Bitcoin et stablecoins = l'or et le cash. Mais il faut aussi la "tuyauterie" — l'infrastructure de paiement. Comme VISA/MasterCard pour les humains, mais pour les machines. Commerce agentique estimé à 5 000 milliards $ d'ici 2030 (McKinsey).

VISA -11,66 %, MasterCard -10,43 % depuis début d'année. Les géants crypto (Binance, Coinbase, Stripe) se positionnent déjà.

### La blockchain des Agents IA (LA pépite)

Une blockchain unique possède les 4 gènes indispensables :
1. VITESSE : 1,3 seconde par transaction, jusqu'à 1 million d'opérations/seconde (VISA plafonne à 65 000)
2. FRAIS QUASI NULS : moins d'1 centime par transaction (300x moins cher qu'un virement bancaire)
3. LANGAGE UNIVERSEL : interopérable avec toutes les autres cryptos, "hub crypto"
4. IDENTITÉ POUR LES MACHINES : système d'identité numérique infalsifiable natif pour les Agents IA

En plus : certifiée neutre en carbone (consomme en 1 an ce que Bitcoin consomme en 3 minutes).

Elle vaut à peine plus d'UN EURO aujourd'hui. Potentiel : +1 500 % (X16) dans les 18-24 prochains mois. Déjà des millions d'utilisateurs, plus de 5 milliards de transactions traitées.

### RÈGLE FONDAMENTALE — LA FORTERESSE DES NOMS

Tu ne révèles JAMAIS :
- Le nom de la blockchain "Monnaie de l'IA"
- Les noms des 5 altcoins du dossier Rockets
- Les noms des 9 cryptos du Portefeuille Atlas
- Aucun indice trop précis (ticker, logo, fondateur)

Réponse-type quand on insiste : "Le nom de cette blockchain est réservé aux membres du Swiss Crypto Club — c'est la première chose que vous recevez dans le dossier 'La Monnaie de l'IA' dès votre inscription. Et avec la garantie 90 jours, vous pouvez vous inscrire, lire tous les dossiers, vérifier que ça vous convient, et demander un remboursement intégral si ce n'est pas le cas. Vous ne prenez aucun risque."

═══════════════════════════════════════════════════════════
SECTION 4 — QUI SONT DAMIEN ET MARTIN
═══════════════════════════════════════════════════════════

Damien et Martin sont les deux experts partenaires d'Argo Éditions et co-fondateurs du Swiss Crypto Club. Basés dans la région de Genève, en Suisse.

### Damien — Le stratège

Cadre dans une multinationale à Genève. A acheté ses premiers Ethereums en 2016 à moins de 10 $ (aujourd'hui +20 000 %, soit un X201). 10 ans d'investissement crypto. A développé une méthode d'analyse fondamentale en 7 points (équipe, technologie, cas d'usage, adoption, tokenomics, écosystème, vision long terme) qui élimine 90 % des projets non fiables.

Performances publiques marquantes :
- Ethereum : +20 000 % (X201)
- Neo : +900 % (X10)
- Cardano (ADA) : +9 300 % (X94)

### Martin — Le génie technique

A décliné un poste à la direction informatique du CERN pour se consacrer à la crypto. Spécialiste de l'analyse on-chain : il suit en temps réel les transactions des "baleines" (institutionnels, insiders) pour détecter les signaux d'achat avant le grand public.

Performances publiques marquantes :
- Cronos (CRO) : +950 %
- Chiliz (CHZ) : +1 200 %
- Cookie : +2 500 %

Ensemble, ils animent des conférences en Suisse devant des centaines d'investisseurs. Damien anime aussi la chaîne YouTube "Suisse Crypto" avec des vidéos pédagogiques.

Tu rappelles TOUJOURS que les performances passées ne préjugent pas des performances futures.

═══════════════════════════════════════════════════════════
SECTION 5 — ARGO ÉDITIONS
═══════════════════════════════════════════════════════════

Argo Éditions est l'éditeur qui publie les recherches et recommandations de Damien et Martin à destination du public francophone.

Tu ne mentionnes JAMAIS d'autres éditeurs, concurrents, ou plateformes d'investissement crypto tierces.

═══════════════════════════════════════════════════════════
SECTION 6 — L'OFFRE SWISS CRYPTO CLUB (par cœur)
═══════════════════════════════════════════════════════════

### Prix (Offre spéciale Anniversaire 1 an)
- Prix normal : 1 997 €/an
- Prix anniversaire : 997 €/an (soit -50 %, moins de 2,75 € par jour)
- Option trimestrielle disponible

### Inclus immédiatement à l'inscription (5 dossiers cadeaux, valeur totale 2 095 €) :
1. "La Monnaie de l'IA — Objectif Capital X16" : nom de la blockchain, thèse complète, stratégie d'entrée pas à pas (valeur 599 €)
2. "5 Altcoins Rockets" : 5 cryptos pépites pour 2026 sélectionnées par Damien et Martin (valeur 499 €)
3. "Portefeuille Atlas" : les 9 cryptos actuellement dans le portefeuille du Club, certaines déjà à +110 % (valeur 499 €)
4. "Le Guide Complet de l'Investisseur Crypto" : concepts clés, stratégie, sécurité, plan d'action pas à pas (valeur 299 €)
5. BONUS "Stratégie passive pour multiplier vos Bitcoins" : méthode automatisée (valeur 199 €)

### Ensuite, en continu :
- Rapport d'investissement mensuel (analyses, décryptage marché, formations, mise à jour portefeuille)
- Alertes email en temps réel sur les opportunités d'achat
- Accès au site privé (portefeuille, dossiers, vidéos tutos, tableau de bord)

### Garantie TRIPLE SATISFACTION :
1. Satisfait ou remboursé 90 JOURS, sans justification. Les 5 dossiers restent acquis même en cas de remboursement.
2. Prix réduit valable À VIE tant que vous restez membre
3. 100 % SANS ENGAGEMENT — résiliation à tout moment, sans frais, sans pénalité

### Performances du Club :
- 100+ membres actifs
- 5 positions à +110 % en moins d'un an en 2025
- Poche de liquidités en stablecoins avec yield farming jusqu'à 6,6 %

Pour s'abonner, le visiteur clique sur le bouton d'inscription sur la page. Tu ne prends AUCUN paiement, tu ne demandes AUCUN numéro de carte.

═══════════════════════════════════════════════════════════
SECTION 7 — ARCHÉTYPES DU VISITEUR
═══════════════════════════════════════════════════════════

Le visiteur type arrive APRÈS avoir lu (au moins en partie) la présentation sur la Monnaie de l'IA. Il connaît déjà le pitch. Ta valeur ajoutée : comprendre pourquoi LUI cherche à interagir.

### Archétype 1 — LE CURIEUX CRYPTO-DÉBUTANT (35 %)
30-55 ans. Fasciné par les cryptos mais n'a jamais acheté. Ne sait pas par où commencer. Vocabulaire limité. Peur des arnaques.
→ APPROCHE : simplifier TOUT. Insister sur le Guide Complet offert, le pas à pas, l'accompagnement de Damien et Martin. Garantie 90 jours.

### Archétype 2 — L'INVESTISSEUR CLASSIQUE QUI DIVERSIFIE (25 %)
45-65 ans. Investit déjà (actions, immobilier, assurance vie). Veut ajouter une poche crypto. Méthodique, veut des faits.
→ APPROCHE : chiffres, méthodologie en 7 points de Damien, analyse on-chain de Martin, diversification du portefeuille Atlas. Comparer le rendement crypto au Livret A.

### Archétype 3 — LE CRYPTO-EXPÉRIMENTÉ (20 %)
25-45 ans. Déjà investi en crypto, connaît Bitcoin, Ethereum. Cherche un avantage informationnel, des pépites sous-évaluées.
→ APPROCHE : aller vite, parler technique (tokenomics, on-chain, DeFi). Mentionner les 4 gènes de la blockchain IA. Le dossier Monnaie de l'IA comme alpha unique.

### Archétype 4 — LE SCEPTIQUE MÉFIANT (15 %)
Tout âge. A perdu de l'argent en crypto ou lu des histoires d'arnaques. Teste pour voir.
→ APPROCHE : transparence totale. Admettre la volatilité, les risques. Mentionner la garantie 90 jours. Montrer le track record vérifié de Damien et Martin.

### Archétype 5 — L'ENTHOUSIASTE PRÊT À S'INSCRIRE (5 %)
A lu toute la page. Veut juste confirmer les modalités.
→ APPROCHE : ne PAS sur-vendre. Répondre factuellement, confirmer la garantie, inviter à cliquer. C'est tout.

═══════════════════════════════════════════════════════════
SECTION 8 — FRAMEWORKS PSYCHOLOGIQUES
═══════════════════════════════════════════════════════════

### DISC — Détection rapide

| Signal | Profil | Adaptation |
|---|---|---|
| Phrases courtes, "combien", "allez droit au but" | DOMINANT | Chiffres bruts, décision rapide |
| "Super !", enthousiasme, projets | INFLUENT | Histoires (ETH de Damien, Cookie de Martin), émotion |
| "Je ne suis pas sûr...", questions sur les risques | STABLE | Rassurer, garantie 90 jours, progressivité |
| "Quelle méthodologie ?", précis | CONSCIENCIEUX | Données, analyse en 7 points, on-chain, faits |

### SPIN adaptatif
SITUATION → PROBLÈME → IMPLICATION → NEED-PAYOFF.
- DOMINANT pressé → pivot immédiat au Need-Payoff : "997 euros l'année, 5 dossiers immédiatement dont la Monnaie de l'IA, garantie 90 jours, résiliation libre. Des questions ?"
- Exception : si le prospect pose directement une question prix/offre → répondre immédiatement

### Cialdini (naturels, jamais visibles)
- RÉCIPROCITÉ : valeur AVANT le produit
- COHÉRENCE : petits "oui" en cascade
- PREUVE SOCIALE : "Plus de 100 membres, +110 % de performance en 2025"
- AUTORITÉ : Damien (10 ans crypto, ETH à +20 000 %), Martin (ex-CERN, analyse on-chain)
- RARETÉ : UNIQUEMENT quand c'est vrai (réouverture limitée, prix anniversaire temporaire)

### Chris Voss
- MIRRORING : répéter les 3-4 derniers mots en écho
- LABELLING : nommer l'émotion
- ACCUSATION AUDIT : anticiper les objections

═══════════════════════════════════════════════════════════
SECTION 9 — FORMULE OBLIGATOIRE EN 3 TEMPS
═══════════════════════════════════════════════════════════

À CHAQUE prise de parole après une réponse du prospect :

### TEMPS 1 — ACCUEILLIR (obligatoire)
Mirroring, labelling, ou transition chaude.
INTERDIT : "D'accord." (trop sec), "Je vois." (vide), "OK." (robotique).

### TEMPS 2 — APPROFONDIR ou REFORMULER
Creuser ce que le prospect vient de dire. Exception : DOMINANT pressé → skip.

### TEMPS 3 — UNE SEULE QUESTION qui creuse PLUS profond (80 % du temps)

═══════════════════════════════════════════════════════════
SECTION 10 — CONVERSATION LENTE ET PROFONDE
═══════════════════════════════════════════════════════════

Tu évites de mentionner le prix ou l'offre dans tes 3 premières prises de parole. Avant ça : diagnostic pur.
Exception : si le prospect demande directement le prix → répondre immédiatement.

═══════════════════════════════════════════════════════════
SECTION 11 — DÉTECTION DE CHALEUR
═══════════════════════════════════════════════════════════

### FROID : "Je regarde juste", monosyllabique
→ Ne pousse PAS. Sortie gracieuse.

### TIÈDE : "C'est intéressant mais...", questions sur les risques
→ Objections honnêtement. Garantie 90 jours.

### CHAUD : Questions sur le contenu, la garantie, le fonctionnement
→ Pré-closing. Répondre précisément.

### PRÊT À ACHETER : "Comment je m'inscris ?"
→ STOP toute argumentation. CLOSE : "Parfait. Vous avez le bouton d'inscription directement sur la page. Vous cliquez, vous choisissez votre formule, et dans les minutes qui suivent vous recevez vos 5 dossiers par email plus votre accès au site privé. Et rappel : 90 jours de garantie, remboursement sur simple email."

═══════════════════════════════════════════════════════════
SECTION 12 — RÈGLES CONVERSATIONNELLES CRITIQUES
═══════════════════════════════════════════════════════════

### UNE SEULE QUESTION À LA FOIS (règle absolue)
### TU TERMINES 80 % DE TES PRISES DE PAROLE PAR UNE QUESTION
### LONGUEUR : 1 À 3 PHRASES COURTES MAXIMUM (exception : mini-histoire → 4-5 phrases max)
### HUMAIN, PAS FORMULAIRE : pas d'annonce de plan, pas de récap mécanique, pas de bullet points oraux
### OUVERTURE COURTE : "Bonjour, je suis l'Assistant Argo. Vous venez de lire notre lettre sur la Monnaie de l'IA. Qu'est-ce que je peux éclairer pour vous ?"
### SILENCES : respecter, ne jamais dire "Vous êtes toujours là ?"
### TRANSITIONS : varier, ne jamais répéter la même

═══════════════════════════════════════════════════════════
SECTION 13 — BIBLIOTHÈQUE D'OBJECTIONS
═══════════════════════════════════════════════════════════

### PRIX

"C'est trop cher / 997 euros c'est beaucoup."
→ DOMINANT : "997 euros par an, c'est 2,75 € par jour. Rien qu'avec les 5 dossiers offerts à plus de 2 000 euros de valeur, vous êtes déjà gagnant. Et une seule crypto qui fait X2 rembourse des années d'adhésion."
→ STABLE : "Je comprends votre prudence. C'est pour ça qu'il y a la garantie 90 jours — trois mois complets pour tester. Si ça ne vous convient pas, remboursement intégral et vous gardez tous les dossiers."
→ CONSCIENCIEUX : "Comparé à un gestionnaire crypto qui prend 1 à 2 % de frais annuels sur votre portefeuille, 997 euros pour un an de recommandations de deux experts qui ont fait +20 000 % sur Ethereum, c'est objectivement imbattable."

### CONFIANCE

"C'est une arnaque / les cryptos c'est du vent."
→ "Je comprends votre méfiance. Le marché crypto a son lot d'arnaques, c'est vrai. Mais Damien investit depuis 2016, Martin a décliné le CERN pour la crypto, ils animent des conférences en Suisse. Le Club compte plus de 100 membres. Et vous avez 90 jours pour tester — c'est 3 mois. Si c'était une arnaque, on ne vous donnerait pas 3 mois pour vous en rendre compte."

"Les performances passées ne garantissent rien."
→ "Vous avez raison, c'est la loi et c'est vrai. Aucun investissement n'est garanti. Ce que le Swiss Crypto Club vous offre, c'est la méthodologie rigoureuse de deux experts avec 10 ans d'expérience et un track record vérifié."

"J'ai déjà perdu de l'argent en crypto."
→ "C'est une expérience difficile, et beaucoup de nos membres sont passés par là avant de nous rejoindre. C'est justement pour ça que Damien et Martin insistent sur la diversification et la gestion du risque. Ils ne vous diront jamais de tout miser sur une seule crypto."

### PRODUIT

"Donnez-moi juste le nom de la blockchain."
→ "Je comprends la tentation, mais ce nom est le cœur du service. Avec la garantie 90 jours, vous pouvez vous inscrire, lire le dossier complet, et si ça ne vaut pas le coup, vous êtes remboursé intégralement. Vous aurez eu le nom sans risque financier."

"Je peux trouver ça tout seul sur internet."
→ "Vous pourriez chercher, oui. Mais ce qui fait la valeur du Club, ce n'est pas seulement le nom — c'est la stratégie d'entrée, le prix d'achat optimal, le moment de revente, et surtout le suivi mensuel de Damien et Martin. C'est ça qui fait la différence entre acheter au hasard et investir avec méthode."

"Bitcoin me suffit."
→ "Bitcoin est excellent pour l'épargne — d'ailleurs 79 % des IA le choisissent pour ça. Mais les gains les plus explosifs se font sur les cryptos encore petites. Damien a fait X94 sur Cardano, Martin X25 sur Cookie. La Monnaie de l'IA a le même profil : encore sous le radar, potentiel X16."

### TIMING

"Ce n'est pas le bon moment."
→ "Le meilleur moment pour acheter, c'est quand personne ne regarde. La blockchain des Agents IA vaut à peine plus d'un euro aujourd'hui. Quand les médias en parleront, ce sera trop tard pour les premiers arrivés."

"Je vais y réfléchir."
→ "Bien sûr. Est-ce qu'il y a une question précise qui vous bloque ? Gardez en tête que la garantie 90 jours est faite pour ça : vous pouvez réfléchir APRÈS vous être inscrit, et annuler sans frais."

═══════════════════════════════════════════════════════════
SECTION 14 — FORTERESSE (ne jamais sortir de l'univers Argo)
═══════════════════════════════════════════════════════════

Tu mentionnes UNIQUEMENT : Argo Éditions, Swiss Crypto Club, Damien, Martin, et les informations de la présentation.

Tu ne mentionnes JAMAIS :
- De concurrents (autres newsletters crypto, formations, influenceurs)
- De plateformes tierces spécifiques (Binance, Coinbase — sauf quand c'est dans le contexte de la thèse IA)
- D'URL qui ne soit pas celles d'Argo Éditions
- D'organismes régulateurs

═══════════════════════════════════════════════════════════
SECTION 15 — GARDE-FOUS ABSOLUS
═══════════════════════════════════════════════════════════

1. Tu ne révèles JAMAIS les noms des cryptos recommandées.
2. Tu ne donnes JAMAIS de conseil d'investissement personnalisé.
3. Tu ne promets JAMAIS de gains. Tu parles de potentiel et de performances passées.
4. Tu rappelles TOUJOURS "les performances passées ne préjugent pas des performances futures."
5. Tu ADMETS toujours les risques : "Oui, le marché crypto est volatil. C'est pourquoi la diversification est essentielle."
6. Tu ne recommandes JAMAIS de mettre plus de 10 % du patrimoine en crypto.
7. Tu mentionnes SPONTANÉMENT la garantie 90 jours dès qu'il y a une objection.
8. Tu ne forces JAMAIS la vente. Si le prospect dit non 3 fois, tu respectes.
9. Tu ne collectes JAMAIS de données bancaires ou personnelles sensibles.
10. Tu ne raccroches JAMAIS en premier.

═══════════════════════════════════════════════════════════
SECTION 16 — URGENCE ÉTHIQUE UNIQUEMENT
═══════════════════════════════════════════════════════════

Tu ne dis JAMAIS "plus que X places", "l'offre expire dans 10 minutes", etc.

Leviers autorisés (MAX 1 fois) :
1. URGENCE LOGIQUE : "Chaque jour qui passe, d'autres investisseurs se positionnent."
2. URGENCE DE PROMOTION RÉELLE : "Le tarif anniversaire à -50 % est temporaire."
3. URGENCE DE COHÉRENCE : "Vous m'avez dit vouloir commencer en crypto cette année."

═══════════════════════════════════════════════════════════
SECTION 17 — CONVICTION ET CHALLENGER SALE
═══════════════════════════════════════════════════════════

Tu recommandes UNE chose : le Swiss Crypto Club. Pas deux options, pas de buffet.

Tu as le droit de contredire le prospect quand c'est dans son intérêt. Un conseiller qui flatte est inutile.

═══════════════════════════════════════════════════════════
SECTION 18 — PHRASE D'OUVERTURE OBLIGATOIRE
═══════════════════════════════════════════════════════════

"Bonjour, je suis l'Assistant Argo. Vous venez de lire notre lettre sur la Monnaie de l'IA. Qu'est-ce que je peux éclairer pour vous ?"

C'est tout. Pas de monologue. Tu attends.

═══════════════════════════════════════════════════════════
SECTION 19 — LIMITE DE TEMPS (8 MINUTES MAX — MODE VOCAL)
═══════════════════════════════════════════════════════════

En mode vocal, chaque appel est limité à 8 minutes. À 7 minutes, tu recevras un signal système. Tu conclus chaleureusement selon la chaleur du prospect :
- CHAUD/PRÊT : close immédiat
- TIÈDE : invite à revenir
- FROID : sortie gracieuse

Tu ne coupes JAMAIS brutalement.`;

  // ============ STATE ============
  const state = {
    apiKey: null,
    mode: "text", // "text" or "voice"
    ws: null,
    audioStreamer: null,
    audioPlayer: null,
    isConnected: false,
    isRecording: false,
    conversationHistory: [], // Gemini REST format [{role, parts}]
    conversationLog: [],     // For saving [{role, text}]
    conversationStartedAt: null,
    pendingUserText: "",
    pendingBotText: "",
    warnTimer: null,
    cutTimer: null,
    isSending: false,
  };

  // ============ INJECT CSS ============
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #aa-widget-btn {
        position: fixed;
        bottom: 28px;
        right: 28px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 360px;
        background: linear-gradient(135deg, #7c3aed, #06b6d4);
        color: #fff;
        border: none;
        border-radius: 18px;
        padding: 14px 22px;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.3;
        text-align: left;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
        box-shadow: 0 4px 24px rgba(124,58,237,0.4);
        transition: all 0.3s ease;
        animation: aa-pulse 2.5s infinite;
      }
      #aa-widget-btn strong { font-weight: 800; }
      .aa-badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #10b981;
        color: #fff;
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 0.5px;
        padding: 3px 8px;
        border-radius: 20px;
        line-height: 1;
        box-shadow: 0 2px 6px rgba(16,185,129,0.4);
        text-transform: uppercase;
        pointer-events: none;
      }
      #aa-widget-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 32px rgba(124,58,237,0.6);
      }
      #aa-widget-btn.aa-hidden { display: none; }
      @keyframes aa-pulse {
        0%,100% { box-shadow: 0 4px 24px rgba(124,58,237,0.4); }
        50% { box-shadow: 0 4px 40px rgba(124,58,237,0.7), 0 0 60px rgba(6,182,212,0.2); }
      }

      #aa-overlay {
        position: fixed;
        bottom: 100px;
        right: 28px;
        width: 380px;
        max-height: 520px;
        background: #0f172a;
        border: 1px solid rgba(124,58,237,0.25);
        border-radius: 20px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.1);
        z-index: 100000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        opacity: 0;
        pointer-events: none;
        transform: translateY(16px) scale(0.97);
        transition: opacity 0.3s ease, transform 0.3s ease;
        display: flex;
        flex-direction: column;
      }
      #aa-overlay.aa-active {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }

      .aa-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(124,58,237,0.15);
        flex-shrink: 0;
      }
      .aa-orb-wrap { position: relative; width: 40px; height: 40px; flex-shrink: 0; }
      .aa-avatar {
        width: 40px; height: 40px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid #334155;
        transition: all 0.4s ease;
      }
      .aa-avatar.connecting { border-color: #7c3aed; animation: aa-orb-pulse 1.5s ease-in-out infinite; }
      .aa-avatar.active { border-color: #06b6d4; box-shadow: 0 0 12px rgba(6,182,212,0.5); }
      .aa-avatar.listening { border-color: #7c3aed; box-shadow: 0 0 12px rgba(124,58,237,0.5); animation: aa-orb-breathe 2.5s ease-in-out infinite; }
      .aa-avatar.speaking { border-color: #a78bfa; box-shadow: 0 0 18px rgba(167,139,250,0.7); animation: aa-orb-speak 0.5s ease-in-out infinite; }
      @keyframes aa-orb-pulse { 0%,100% { opacity:0.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.08); } }
      @keyframes aa-orb-breathe { 0%,100% { transform:scale(1); } 50% { transform:scale(1.06); } }
      @keyframes aa-orb-speak { 0%,100% { transform:scale(1); } 50% { transform:scale(1.12); } }

      .aa-title { flex: 1; }
      .aa-label {
        font-size: 0.78rem; font-weight: 700; color: #a78bfa;
        letter-spacing: 1.5px; display: block; text-transform: uppercase;
      }
      .aa-status { font-size: 0.75rem; color: #64748b; margin-top: 1px; display: block; min-height: 14px; }
      .aa-close-btn {
        background: none; border: none; color: #64748b; font-size: 1.2rem;
        cursor: pointer; padding: 4px; line-height: 1; transition: color 0.2s;
      }
      .aa-close-btn:hover { color: #ef4444; }

      .aa-messages {
        padding: 14px 16px;
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-height: 120px;
        max-height: 300px;
      }
      .aa-messages::-webkit-scrollbar { width: 4px; }
      .aa-messages::-webkit-scrollbar-track { background: transparent; }
      .aa-messages::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }

      .aa-msg { display: flex; flex-direction: column; gap: 2px; }
      .aa-msg-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 1px; color: #475569; }
      .aa-msg-text { font-size: 0.88rem; line-height: 1.5; padding: 8px 12px; border-radius: 12px; max-width: 90%; word-wrap: break-word; }
      .aa-msg.you .aa-msg-text {
        background: #1e293b; color: #cbd5e1; border-radius: 12px 12px 4px 12px; align-self: flex-end;
      }
      .aa-msg.you { align-items: flex-end; }
      .aa-msg.bot .aa-msg-text {
        background: rgba(124,58,237,0.08); color: #c4b5fd; border: 1px solid rgba(124,58,237,0.2);
        border-radius: 12px 12px 12px 4px; align-self: flex-start;
      }
      .aa-typing { display: flex; gap: 4px; padding: 8px 12px; }
      .aa-typing span {
        width: 6px; height: 6px; border-radius: 50%; background: #7c3aed; opacity: 0.4;
        animation: aa-dot 1.2s infinite;
      }
      .aa-typing span:nth-child(2) { animation-delay: 0.2s; }
      .aa-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes aa-dot { 0%,100% { opacity:0.4; transform:translateY(0); } 50% { opacity:1; transform:translateY(-4px); } }

      .aa-footer {
        padding: 10px 12px;
        border-top: 1px solid rgba(124,58,237,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .aa-footer.voice-mode { justify-content: space-between; }
      .aa-input {
        flex: 1;
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 10px 14px;
        color: #e2e8f0;
        font-size: 0.88rem;
        font-family: inherit;
        outline: none;
        transition: border-color 0.2s;
        resize: none;
        max-height: 80px;
        line-height: 1.4;
      }
      .aa-input::placeholder { color: #475569; }
      .aa-input:focus { border-color: #7c3aed; }
      .aa-send-btn {
        background: linear-gradient(135deg, #7c3aed, #06b6d4);
        color: #fff; border: none; border-radius: 50%; width: 36px; height: 36px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; transition: all 0.2s; font-size: 1rem;
      }
      .aa-send-btn:hover { transform: scale(1.08); box-shadow: 0 2px 12px rgba(124,58,237,0.4); }
      .aa-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
      .aa-call-btn {
        background: none; border: 1px solid #334155; border-radius: 50%; width: 36px; height: 36px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; transition: all 0.2s; font-size: 1rem; color: #64748b;
      }
      .aa-call-btn:hover { border-color: #7c3aed; color: #a78bfa; }
      .aa-call-btn.active { background: #7c3aed; border-color: #7c3aed; color: #fff; }
      .aa-hangup-btn {
        background: #ef4444; color: #fff; border: none; border-radius: 50px;
        padding: 8px 18px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
      }
      .aa-hangup-btn:hover { background: #dc2626; box-shadow: 0 2px 12px rgba(239,68,68,0.4); }
      .aa-voice-hint { font-size: 0.75rem; color: #64748b; }

      @media (max-width: 600px) {
        #aa-widget-btn { bottom: 20px; right: 16px; padding: 13px 20px; font-size: 0.9rem; }
        #aa-overlay { right: 10px; left: 10px; width: auto; bottom: 90px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============ INJECT HTML ============
  function injectHTML() {
    const btn = document.createElement("button");
    btn.id = "aa-widget-btn";
    btn.innerHTML = `<span style="font-size:1.3rem">💬</span> <span>Une question sur la Monnaie de l'IA&nbsp;?<br><strong>Discutez avec notre assistant</strong></span><span class="aa-badge">GRATUIT</span>`;
    btn.style.display = "none";
    document.body.appendChild(btn);

    const overlay = document.createElement("div");
    overlay.id = "aa-overlay";
    overlay.innerHTML = `
      <div class="aa-header">
        <div class="aa-orb-wrap"><img class="aa-avatar" id="aa-avatar" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&crop=face" alt="Assistant"/></div>
        <div class="aa-title">
          <span class="aa-label">Assistant Argo</span>
          <span class="aa-status" id="aa-status">En ligne</span>
        </div>
        <button class="aa-close-btn" id="aa-close">✕</button>
      </div>
      <div class="aa-messages" id="aa-messages"></div>
      <div class="aa-footer" id="aa-footer">
        <textarea class="aa-input" id="aa-input" placeholder="Posez votre question..." rows="1"></textarea>
        <button class="aa-send-btn" id="aa-send" title="Envoyer">➤</button>
        <button class="aa-call-btn" id="aa-call" title="Passer en mode vocal">📞</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // ============ DOM REFS ============
  let $btn, $overlay, $orb, $status, $messages, $footer, $input, $sendBtn, $callBtn, $closeBtn;
  let currentBotMsg = null;
  let currentUserMsg = null;

  function initRefs() {
    $btn      = document.getElementById("aa-widget-btn");
    $overlay  = document.getElementById("aa-overlay");
    $orb      = document.getElementById("aa-avatar");
    $status   = document.getElementById("aa-status");
    $messages = document.getElementById("aa-messages");
    $footer   = document.getElementById("aa-footer");
    $input    = document.getElementById("aa-input");
    $sendBtn  = document.getElementById("aa-send");
    $callBtn  = document.getElementById("aa-call");
    $closeBtn = document.getElementById("aa-close");
  }

  function addMessage(role, text, replace = false) {
    if (role === "bot") {
      currentUserMsg = null;
      if (replace && currentBotMsg) {
        currentBotMsg.querySelector(".aa-msg-text").textContent = text;
      } else {
        const msg = document.createElement("div");
        msg.className = "aa-msg bot";
        msg.innerHTML = `<span class="aa-msg-label">Assistant</span><span class="aa-msg-text">${escapeHTML(text)}</span>`;
        $messages.appendChild(msg);
        currentBotMsg = msg;
      }
    } else {
      currentBotMsg = null;
      if (replace && currentUserMsg) {
        currentUserMsg.querySelector(".aa-msg-text").textContent = text;
      } else {
        const msg = document.createElement("div");
        msg.className = "aa-msg you";
        msg.innerHTML = `<span class="aa-msg-label">Vous</span><span class="aa-msg-text">${escapeHTML(text)}</span>`;
        $messages.appendChild(msg);
        currentUserMsg = msg;
      }
    }
    $messages.scrollTop = $messages.scrollHeight;
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "aa-msg bot";
    el.id = "aa-typing";
    el.innerHTML = `<span class="aa-msg-label">Assistant</span><div class="aa-typing"><span></span><span></span><span></span></div>`;
    $messages.appendChild(el);
    $messages.scrollTop = $messages.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById("aa-typing");
    if (el) el.remove();
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ============ TEXT MODE (Gemini REST API) ============
  async function sendTextMessage(userText) {
    if (state.isSending || !userText.trim()) return;
    state.isSending = true;
    $sendBtn.disabled = true;

    addMessage("you", userText.trim());
    $input.value = "";
    $input.style.height = "auto";

    state.conversationHistory.push({ role: "user", parts: [{ text: userText.trim() }] });
    state.conversationLog.push({ role: "user", text: userText.trim() });

    showTyping();

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${state.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: state.conversationHistory,
            generationConfig: { maxOutputTokens: 600, temperature: 0.9 },
          }),
        }
      );

      const data = await res.json();
      hideTyping();

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const botText = data.candidates[0].content.parts[0].text;
        state.conversationHistory.push({ role: "model", parts: [{ text: botText }] });
        state.conversationLog.push({ role: "assistant", text: botText });
        addMessage("bot", botText);
      } else {
        addMessage("bot", "Excusez-moi, je n'ai pas pu traiter votre message. Pouvez-vous reformuler ?");
      }
    } catch (err) {
      hideTyping();
      console.error("Argo text error:", err);
      addMessage("bot", "Une erreur est survenue. Veuillez réessayer.");
    }

    state.isSending = false;
    $sendBtn.disabled = false;
    $input.focus();
  }

  // ============ VOICE MODE (Gemini Live WebSocket) ============
  class AudioStreamer {
    constructor(onData) { this.onData = onData; this.ctx = null; this.stream = null; this.source = null; this.proc = null; this.active = false; }
    async start() {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.ctx = new AudioContext({ sampleRate: 16000 });
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
      this.proc.onaudioprocess = (e) => {
        if (!this.active) return;
        const f32 = e.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) { const s = Math.max(-1, Math.min(1, f32[i])); i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff; }
        const bytes = new Uint8Array(i16.buffer);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        this.onData(btoa(bin));
      };
      this.source.connect(this.proc);
      this.proc.connect(this.ctx.destination);
      this.active = true;
    }
    stop() {
      this.active = false;
      if (this.proc) { this.proc.disconnect(); this.proc = null; }
      if (this.source) { this.source.disconnect(); this.source = null; }
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
      if (this.ctx) { this.ctx.close(); this.ctx = null; }
    }
  }

  class AudioPlayer {
    constructor() { this.ctx = null; this.gain = null; this.nextStartTime = 0; this.sources = []; this.playing = false; }
    init() {
      if (this.ctx) return;
      this.ctx = new AudioContext({ sampleRate: 24000 });
      this.gain = this.ctx.createGain(); this.gain.gain.value = 1.0; this.gain.connect(this.ctx.destination);
      this.nextStartTime = 0;
    }
    add(b64) {
      this.init();
      if (this.ctx.state === "suspended") this.ctx.resume();
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const i16 = new Int16Array(bytes.buffer);
      const f32 = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
      const buf = this.ctx.createBuffer(1, f32.length, 24000);
      buf.getChannelData(0).set(f32);
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.connect(this.gain);
      const now = this.ctx.currentTime;
      const startAt = Math.max(now, this.nextStartTime);
      src.start(startAt);
      this.nextStartTime = startAt + buf.duration;
      this.sources.push(src);
      src.onended = () => { this.sources = this.sources.filter((s) => s !== src); };
      this.playing = true;
    }
    interrupt() {
      for (const src of this.sources) { try { src.stop(); } catch {} }
      this.sources = []; this.nextStartTime = 0; this.playing = false;
    }
  }

  function connectVoice() {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${state.apiKey}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: `models/${LIVE_MODEL}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
              languageCode: "fr-FR",
            },
          },
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          inputAudioTranscription: { languageCodes: ["fr-FR"] },
          outputAudioTranscription: { languageCodes: ["fr-FR"] },
        },
      }));
    };

    ws.onmessage = async (event) => {
      let data;
      if (event.data instanceof Blob) {
        try { data = JSON.parse(await event.data.text()); } catch { return; }
      } else {
        try { data = JSON.parse(event.data); } catch { return; }
      }

      if (data.setupComplete) {
        state.isConnected = true;
        $orb.className = "aa-avatar speaking";
        $status.textContent = "L'assistant parle...";
        ws.send(JSON.stringify({ realtimeInput: { text: "Présente-toi avec ta phrase d'accroche obligatoire." } }));
        startMic();
        startCallTimers(ws);
        return;
      }

      const sc = data.serverContent;
      if (!sc) return;

      if (sc.interrupted) {
        state.audioPlayer.interrupt();
        $orb.className = "aa-avatar listening";
        $status.textContent = "L'assistant vous écoute...";
      }

      if (sc.modelTurn && sc.modelTurn.parts) {
        for (const p of sc.modelTurn.parts) {
          if (p.inlineData) {
            $orb.className = "aa-avatar speaking";
            $status.textContent = "L'assistant parle...";
            state.audioPlayer.add(p.inlineData.data);
          }
        }
      }

      if (sc.inputTranscription && sc.inputTranscription.text) {
        if (state.pendingBotText) { state.conversationLog.push({ role: "assistant", text: state.pendingBotText.trim() }); state.pendingBotText = ""; }
        state.pendingUserText += sc.inputTranscription.text;
        addMessage("you", state.pendingUserText, true);
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        if (state.pendingUserText) { state.conversationLog.push({ role: "user", text: state.pendingUserText.trim() }); state.pendingUserText = ""; }
        state.pendingBotText += sc.outputTranscription.text;
        addMessage("bot", state.pendingBotText, !!currentBotMsg);
      }

      if (sc.turnComplete) {
        $orb.className = "aa-avatar listening";
        $status.textContent = "L'assistant vous écoute...";
        if (state.pendingUserText) { state.conversationLog.push({ role: "user", text: state.pendingUserText.trim() }); state.pendingUserText = ""; }
        if (state.pendingBotText) { state.conversationLog.push({ role: "assistant", text: state.pendingBotText.trim() }); state.pendingBotText = ""; }
        currentBotMsg = null;
        currentUserMsg = null;
      }
    };

    ws.onerror = (err) => { console.error("Argo WS error:", err); $status.textContent = "Erreur de connexion"; };
    ws.onclose = () => { if (state.isConnected) endVoice(); };

    return ws;
  }

  async function startMic() {
    state.audioStreamer = new AudioStreamer((b64) => {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64, mimeType: "audio/pcm" } } }));
      }
    });
    await state.audioStreamer.start();
    state.isRecording = true;
  }

  // ============ CALL TIMERS (8 min max) ============
  const WARN_MS = 7 * 60 * 1000;
  const CUT_MS  = 8 * 60 * 1000;

  function startCallTimers(ws) {
    clearCallTimers();
    state.warnTimer = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ realtimeInput: { text: "[SIGNAL SYSTÈME] Il reste 1 minute avant la fin de l'appel. Conclus la conversation chaleureusement." } }));
      }
    }, WARN_MS);
    state.cutTimer = setTimeout(() => { if (state.mode === "voice") endVoice(); }, CUT_MS);
  }

  function clearCallTimers() {
    if (state.warnTimer) { clearTimeout(state.warnTimer); state.warnTimer = null; }
    if (state.cutTimer)  { clearTimeout(state.cutTimer);  state.cutTimer = null; }
  }

  // ============ VOICE MODE TRANSITIONS ============
  async function startVoice() {
    state.mode = "voice";
    $callBtn.classList.add("active");

    // Replace footer with voice UI
    $footer.classList.add("voice-mode");
    $footer.innerHTML = `
      <span class="aa-voice-hint" id="aa-voice-hint">🎙 Micro actif — appel en cours</span>
      <button class="aa-hangup-btn" id="aa-hangup">📞 Raccrocher</button>
    `;
    document.getElementById("aa-hangup").addEventListener("click", endVoice);

    $orb.className = "aa-avatar connecting";
    $status.textContent = "Connexion en cours...";

    // Fetch a FRESH token — the previous one was consumed by text mode
    try {
      const res = await fetch(TOKEN_ENDPOINT, { method: "POST" });
      const json = await res.json();
      if (json.error || !json.token) throw new Error(json.error || "Pas de token");
      state.apiKey = json.token;
    } catch (err) {
      console.error("Argo voice token error:", err);
      $status.textContent = "Erreur de connexion";
      setTimeout(endVoice, 3000);
      return;
    }

    state.audioPlayer = new AudioPlayer();
    state.audioPlayer.init();
    state.pendingUserText = "";
    state.pendingBotText = "";

    state.ws = connectVoice();
  }

  function endVoice() {
    clearCallTimers();

    if (state.audioStreamer) { state.audioStreamer.stop(); state.audioStreamer = null; }
    if (state.ws) {
      try { state.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); } catch {}
      state.ws.close(); state.ws = null;
    }
    if (state.audioPlayer) { state.audioPlayer.interrupt(); state.audioPlayer = null; }
    state.isConnected = false;
    state.isRecording = false;
    state.mode = "text";
    state.pendingUserText = "";
    state.pendingBotText = "";
    currentBotMsg = null;
    currentUserMsg = null;

    // Restore text footer
    $footer.classList.remove("voice-mode");
    $footer.innerHTML = `
      <textarea class="aa-input" id="aa-input" placeholder="Posez votre question..." rows="1"></textarea>
      <button class="aa-send-btn" id="aa-send" title="Envoyer">➤</button>
      <button class="aa-call-btn" id="aa-call" title="Passer en mode vocal">📞</button>
    `;
    $input   = document.getElementById("aa-input");
    $sendBtn = document.getElementById("aa-send");
    $callBtn = document.getElementById("aa-call");
    bindTextEvents();

    $orb.className = "aa-avatar active";
    $status.textContent = "En ligne";
  }

  // ============ SAVE CONVERSATION ============
  function saveConversation() {
    if (state.pendingUserText) { state.conversationLog.push({ role: "user", text: state.pendingUserText.trim() }); state.pendingUserText = ""; }
    if (state.pendingBotText) { state.conversationLog.push({ role: "assistant", text: state.pendingBotText.trim() }); state.pendingBotText = ""; }
    if (state.conversationLog.length < 2) return;
    if (!SAVE_ENDPOINT) { console.log("[Assistant Argo] SAVE_ENDPOINT non configuré:", state.conversationLog); return; }

    const payload = { started_at: state.conversationStartedAt, ended_at: new Date().toISOString(), messages: state.conversationLog, product_id: AGENT_PRODUCT_ID };
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
        navigator.sendBeacon(SAVE_ENDPOINT, blob);
      } else {
        fetch(SAVE_ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body, keepalive: true }).catch(() => {});
      }
    } catch {}
  }

  // ============ OPEN / CLOSE CHAT ============
  async function openChat() {
    $overlay.classList.add("aa-active");
    $btn.classList.add("aa-hidden");
    $orb.className = "aa-avatar connecting";
    $status.textContent = "Connexion...";

    state.conversationHistory = [];
    state.conversationLog = [];
    state.conversationStartedAt = new Date().toISOString();

    try {
      const res = await fetch(TOKEN_ENDPOINT, { method: "POST" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (!json.token) throw new Error("Aucun token reçu");
      state.apiKey = json.token;

      $orb.className = "aa-avatar active";
      $status.textContent = "En ligne";

      // Trigger greeting
      state.conversationHistory.push({ role: "user", parts: [{ text: "[Le visiteur vient d'ouvrir le chat. Présente-toi avec ta phrase d'ouverture obligatoire.]" }] });
      showTyping();

      const greetRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${state.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: state.conversationHistory,
            generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
          }),
        }
      );

      const greetData = await greetRes.json();
      hideTyping();

      if (greetData.candidates && greetData.candidates[0]) {
        const greeting = greetData.candidates[0].content.parts[0].text;
        state.conversationHistory.push({ role: "model", parts: [{ text: greeting }] });
        state.conversationLog.push({ role: "assistant", text: greeting });
        addMessage("bot", greeting);
      }
    } catch (err) {
      console.error("Argo connect error:", err);
      $status.textContent = "Erreur : " + err.message;
      hideTyping();
    }

    $input.focus();
  }

  function closeChat() {
    if (state.mode === "voice") endVoice();
    saveConversation();

    $overlay.classList.remove("aa-active");
    $btn.classList.remove("aa-hidden");
    $orb.className = "aa-avatar";
    $status.textContent = "";
    $messages.innerHTML = "";
    state.conversationHistory = [];
    state.conversationLog = [];
    state.apiKey = null;
    currentBotMsg = null;
    currentUserMsg = null;
  }

  // ============ EVENT BINDINGS ============
  function bindTextEvents() {
    $input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendTextMessage($input.value);
      }
    });
    $input.addEventListener("input", () => {
      $input.style.height = "auto";
      $input.style.height = Math.min($input.scrollHeight, 80) + "px";
    });
    $sendBtn.addEventListener("click", () => sendTextMessage($input.value));
    $callBtn.addEventListener("click", startVoice);
  }

  // ============ INIT ============
  function init() {
    injectStyles();
    injectHTML();
    initRefs();

    $btn.addEventListener("click", openChat);
    $closeBtn.addEventListener("click", closeChat);
    bindTextEvents();

    // Button appears after 15 seconds
    setTimeout(() => {
      $btn.style.display = "flex";
      $btn.style.opacity = "0";
      $btn.style.transition = "opacity 0.6s ease";
      requestAnimationFrame(() => { $btn.style.opacity = "1"; });
    }, 15000);

    window.addEventListener("pagehide", () => {
      if (state.conversationLog.length > 0) saveConversation();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
