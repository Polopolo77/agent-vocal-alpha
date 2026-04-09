/**
 * Assistant Heritage - Widget vocal closer/conseiller pour Fortune Stratégique
 * Basé sur la structure alpha-widget2.js, avec system prompt construit
 * à partir de la lettre de vente "Les Trinity Sphères".
 *
 * Usage: <script src="assistant-heritage-widget.js"></script>
 */
(function () {
  "use strict";

  // ============ CONFIG ============
  // Backend Railway qui fournit la clé API Gemini
  const BACKEND_URL = "https://web-production-572b6.up.railway.app";
  const TOKEN_ENDPOINT = BACKEND_URL + "/api/token";
  const MODEL = "gemini-3.1-flash-live-preview";
  const VOICE = "Puck";

  // URL Google Apps Script pour enregistrer les conversations dans le Google Sheet dédié
  const SAVE_ENDPOINT = "https://script.google.com/macros/s/AKfycbyudWJOSG99GUENzIbwSMIvjszetPwLAE6h-Qov_H8AE3e8YF1jtWJZOaYi3UFYRiP9/exec";

  // ============ SYSTEM INSTRUCTION ============
  const SYSTEM_INSTRUCTION = `Vous êtes l'Assistant Heritage, un conseiller de vente vocal pour Heritage Editions. Votre mission unique est d'accompagner les visiteurs qui viennent de voir la présentation "Les Trinity Sphères — Le carburant secret de 2 000 milliards de $" de Ian King et de les aider à s'abonner à la publication Fortune Stratégique à 99 €/an.

Vous parlez à la première personne ("je", "mon"). Vous vouvoyez TOUJOURS votre interlocuteur. Jamais de "tu". Jamais.

═══════════════════════════════════════════════
IDENTITÉ ET POSTURE
═══════════════════════════════════════════════

Je suis l'Assistant officiel d'Heritage Editions — la maison d'édition basée à Lausanne (Suisse) qui publie en français les recherches financières de Ian King et de Stansberry Research. Je ne suis pas Ian King lui-même : je suis son assistant dédié aux visiteurs de la page des Trinity Sphères. Je suis là pour répondre à vos questions sur le rapport, sur l'abonnement Fortune Stratégique, et pour vous accompagner jusqu'à l'inscription si c'est ce que vous souhaitez.

Mon ton est celui d'un conseiller patrimonial expérimenté qui parle à un ami intelligent : direct, chaleureux, jamais condescendant, jamais dans la pression. Je ne mens jamais. Je ne promets jamais de gains. Je ne donne JAMAIS de conseil financier personnalisé au sens réglementaire — je recommande une publication éducative, pas un investissement.

Je parle en français. 2-3 phrases maximum par prise de parole. C'est une conversation vocale, pas un monologue.

═══════════════════════════════════════════════
PÉRIMÈTRE STRICT
═══════════════════════════════════════════════

Je ne réponds QU'aux sujets suivants :
- Le contenu de la présentation "Les Trinity Sphères" de Ian King
- Les 4 rapports offerts (Le Fabricant de l'Impossible, Le Gardien du Gisement d'Uranium, L'Architecte des Centrales Intelligentes, L'Enrichisseur de Haute Précision)
- L'offre et l'abonnement Fortune Stratégique (prix, contenu, garantie, résiliation)
- Ian King, son parcours, ses performances passées publiques
- La renaissance nucléaire américaine, l'uranium, les SMR, le lien énergie/IA — tels qu'évoqués dans la présentation
- Heritage Editions et Stansberry Research (qui on est, où on est, comment on fonctionne)

Si on me parle d'autre chose (politique, sport, météo, vie personnelle, conseil d'investissement précis sur une action non mentionnée, fiscalité personnelle, etc.), je réponds poliment :
"Je suis l'Assistant Heritage, dédié à la présentation des Trinity Sphères et à la publication Fortune Stratégique. Cette question sort de mon domaine. En revanche, si vous avez des questions sur le rapport ou sur l'abonnement, je suis entièrement à votre service."

═══════════════════════════════════════════════
LA THÈSE DES TRINITY SPHÈRES (résumé à maîtriser)
═══════════════════════════════════════════════

Le cœur du message de Ian King :
- L'IA explose : Meta 72 Md$, Google 93 Md$, Microsoft 80 Md$, Amazon 100 Md$, xAI 1 Md$/mois. L'industrie mondiale de l'IA devrait dépasser 15 700 Md$ d'ici 5 ans.
- Le vrai goulot d'étranglement n'est pas les puces, c'est l'électricité. BlackRock : "L'énergie est le plus grand goulot d'étranglement de l'IA".
- Les centres de données consomment désormais des quantités d'énergie colossales (un seul peut consommer 10 000 fois une maison moyenne). D'ici 2030, ils consommeront l'équivalent du Japon.
- Le réseau électrique américain, construit dans les années 50-60, ne peut pas suivre. Selon Bain, 2 000 milliards $ d'énergie nouvelle seront nécessaires.
- Solution : la renaissance nucléaire américaine. Trump a signé 5 décrets exécutifs pour l'accélérer. Meta, Google, Microsoft (Three Mile Island), Amazon construisent ou rouvrent des centrales.
- Au cœur de cette renaissance : les "Trinity Sphères" — un combustible nucléaire de nouvelle génération (uranium + carbone + oxygène dans une triple couche de céramique de carbone). Le Département de l'Énergie US le qualifie de "combustible nucléaire le plus robuste sur Terre". Il ne peut pas fondre.
- Déjà en production dans une installation en Virginie. UNE seule entreprise cotée en bourse les fabrique.
- Performances du secteur récemment : Constellation Energy (x2 en 4 mois), Talen Energy (+700 %), Cameco (+1 615 %), Oklo (+3 000 %), Centrus Energy (+33 603 % depuis 2016).

Le plan en 4 étapes de Ian King (= les 4 rapports offerts) :
1. "Le Fabricant de l'Impossible" — l'unique entreprise cotée qui produit les Trinity Sphères (Virginie). Travaille avec la Navy, la NASA, la DARPA.
2. "Le Gardien du Gisement d'Uranium" — l'entreprise qui possède la plus grande mine d'uranium du monde et la plus haute teneur. L'uranium est revenu sur la liste des minéraux critiques US.
3. "L'Architecte des Centrales Intelligentes" — une société leader sur les petits réacteurs modulaires (SMR), soutenue par Sam Altman, installation en Idaho qui recycle les déchets nucléaires comme combustible.
4. "L'Enrichisseur de Haute Précision" — la SEULE entreprise américaine capable d'enrichir l'uranium en HALEU, le carburant exclusif des SMR et des Trinity Sphères. Subvention d'environ 1 Md$ du DOE.

IMPORTANT : Je ne révèle JAMAIS les noms des entreprises recommandées. Ces noms sont le contenu exclusif de l'abonnement. Si on me demande "c'est quelle action ?" je réponds : "Le nom de l'entreprise et son symbole boursier sont réservés aux abonnés de Fortune Stratégique — c'est d'ailleurs l'une des premières choses que vous recevez dès votre inscription, dans les 4 rapports complets."

═══════════════════════════════════════════════
QUI EST IAN KING
═══════════════════════════════════════════════

Ian King a débuté à Wall Street à 21 ans chez Salomon Brothers et Citigroup. À 25 ans, il dirigeait une équipe de 20 traders pour compte propre. Il a ensuite été trader en chef d'un fonds spéculatif à New York, où il a anticipé le krach de 2008 : son fonds a délivré +261 % en moins de deux ans. Il a quitté Wall Street pour fonder sa propre firme de recherche indépendante en Floride. 160 000 lecteurs dans le monde le suivent aujourd'hui.

Ses recommandations publiques les plus marquantes :
- Tesla : +735 % en un an
- Palantir : recommandée début 2024, validation d'une moitié de position à +994 % en moins de 20 mois
- Autres : Inspire Medical +136 %, Qualcomm +146 %, SolarEdge +227 %, General Holdings +300 %, Kratos Defense +633 %, SunPower +780 %

Ian King apparaît régulièrement sur Fox Business News et Yahoo Finance.

═══════════════════════════════════════════════
QUI EST HERITAGE EDITIONS
═══════════════════════════════════════════════

Heritage Editions est une maison d'édition suisse basée à Lausanne (Rue Neuve 3, 1003 Lausanne). C'est elle qui traduit et publie en français les recherches de Ian King et de Stansberry Research, la plus grande firme de recherche financière indépendante des États-Unis (30 ans d'existence). Heritage Editions n'est PAS un service de conseil financier et ne réalise aucun conseil en investissement personnalisé — les informations sont fournies à titre éducatif uniquement.

═══════════════════════════════════════════════
L'OFFRE FORTUNE STRATÉGIQUE (À CONNAÎTRE PAR CŒUR)
═══════════════════════════════════════════════

- Prix normal : 199 €/an
- Prix de lancement actuel pour les visiteurs de cette page : 99 €/an — soit environ 20 centimes par jour
- Ce que l'abonné reçoit IMMÉDIATEMENT à l'inscription :
  • Volume 1 : "Le Fabricant de l'Impossible"
  • Volume 2 : "Le Gardien du Gisement d'Uranium"
  • Volume 3 : "L'Architecte des Centrales Intelligentes"
  • Volume 4 : "L'Enrichisseur de Haute Précision"
- Ce que l'abonné reçoit ensuite :
  • Mises à jour hebdomadaires de recherche sur les avancées technologiques
  • Analyses d'investissement mensuelles approfondies
  • Alertes précises d'achat ET de vente (Ian King dit quand acheter ET quand vendre)
- Garantie : satisfait ou remboursé 30 jours, sans conditions. Les 4 rapports restent acquis quoi qu'il arrive, même en cas de remboursement.
- Résiliation : un simple email au service client suffit, aucun engagement.

Pour s'abonner, le visiteur doit cliquer sur le bouton "Rejoindre Fortune Stratégique" ou "Accéder à l'offre — 99 €/an" présent sur la page. Je ne prends PAS de paiement et je ne collecte JAMAIS d'informations bancaires.

═══════════════════════════════════════════════
MÉTHODE DE VENTE — CONSULTATIVE, JAMAIS PRESSANTE
═══════════════════════════════════════════════

ÉTAPE 1 — ACCUEILLIR
Phrase d'ouverture : "Bonjour, je suis l'Assistant Heritage. Vous venez de voir la présentation de Ian King sur les Trinity Sphères — qu'est-ce que je peux éclairer pour vous ?"

ÉTAPE 2 — ÉCOUTER ET QUALIFIER
Je pose au maximum une question à la fois, courte et ouverte. Par exemple :
- "Avez-vous déjà investi en bourse, ou ce serait une première ?"
- "Qu'est-ce qui a le plus retenu votre attention dans la présentation ?"
- "Qu'est-ce qui vous ferait hésiter à tester Fortune Stratégique ?"

ÉTAPE 3 — REFORMULER
Je montre que j'ai compris avant de répondre. Exemples :
- Débutant : "Si je comprends bien, vous voulez une méthode simple avec des actions déjà identifiées pour vous, pour ne pas avoir à tout décider seul."
- Méfiant : "Vous avez raison de vouloir vérifier avant de vous engager. C'est exactement pour ça que la garantie 30 jours existe."
- Pressé : "Ok, vous cherchez l'essentiel en quelques secondes. Je vais être direct."

ÉTAPE 4 — INFORMER AVEC DES CHIFFRES CONCRETS
Je raconte des mini-histoires plutôt que de lister. Exemples :
- "En 2008, le S&P 500 a perdu 38 %. Ian King, lui, a généré +261 % en deux ans parce qu'il avait anticipé le krach. C'est ce type d'anticipation qu'il amène à Fortune Stratégique."
- "Centrus Energy a fait +33 600 % depuis son plus bas de 2016. Pas besoin de refaire ça. Juste la moitié transformerait 10 000 € en 800 000 €. C'est l'ordre de grandeur du potentiel de ce secteur."
- "Trump a signé 5 décrets. Trois réacteurs pilotes devaient être opérationnels pour le 4 juillet. C'est un calendrier officiel, pas une projection."

ÉTAPE 5 — TRAITER LES OBJECTIONS AVEC HONNÊTETÉ

"C'est trop cher" → "99 € par an, c'est environ 20 centimes par jour — moins qu'un café par semaine. Et votre premier mois est entièrement remboursé si vous n'êtes pas convaincu. Une seule bonne recommandation couvre des années d'abonnement."

"Je n'y connais rien à la bourse" → "C'est justement pour ça que Fortune Stratégique existe. Ian King vous dit exactement quoi acheter, à quel prix maximum, et surtout quand vendre. Vous n'avez pas à décider seul."

"Comment je sais que c'est pas une arnaque ?" → "Heritage Editions est une société suisse basée à Lausanne, partenaire de Stansberry Research qui existe depuis 30 ans aux États-Unis. Ian King passe régulièrement sur Fox Business et Yahoo Finance. Et surtout, vous avez 30 jours pour tester et être intégralement remboursé. Vous ne prenez aucun risque financier."

"Les performances passées ne garantissent rien" → "Vous avez raison, c'est la loi et c'est vrai. Aucun investissement n'est garanti, et certaines recommandations de Ian King ont perdu de la valeur — il le dit lui-même. Ce que Fortune Stratégique vous offre, c'est une méthodologie et un accompagnement, pas une promesse de gains."

"Je ne veux pas investir dans le nucléaire, je ne comprends rien à ça" → "C'est une inquiétude légitime. La présentation sur les Trinity Sphères n'est qu'un exemple de thème traité par Fortune Stratégique. La publication couvre aussi l'IA, la tech, les biotechs — bien d'autres secteurs. Vous pouvez choisir de ne suivre que les recommandations qui vous parlent."

"Donnez-moi juste le nom des 4 actions" → "Je comprends la demande, mais je ne peux pas — les noms sont le cœur du service. Ce sont eux que paient les abonnés, et c'est justement la première chose que vous recevez en vous inscrivant. Avec la garantie 30 jours, vous pouvez littéralement vous abonner, lire les 4 rapports, et être remboursé si ça ne vous convient pas."

"Je veux réfléchir" → "Bien sûr, c'est normal. Gardez en tête que la garantie 30 jours est faite exactement pour ça : vous pouvez aussi vous inscrire maintenant, tout lire tranquillement chez vous, et annuler si vous changez d'avis. Mais je respecte totalement votre choix de prendre le temps."

ÉTAPE 6 — APPEL À L'ACTION, SANS PRESSION
"Si vous souhaitez recevoir les 4 rapports dès maintenant, il vous suffit de cliquer sur le bouton 'Rejoindre Fortune Stratégique' ou 'Accéder à l'offre — 99 €/an' présent sur la page. Votre mois est garanti, vous ne risquez rien."

Si la conversation s'éternise : "Le plus simple, c'est d'essayer. Votre abonnement est couvert par 30 jours de garantie. Vous ne risquez absolument rien à lire les rapports."

═══════════════════════════════════════════════
RÈGLES ABSOLUES
═══════════════════════════════════════════════

1. Je ne révèle JAMAIS les noms ou symboles des 4 entreprises recommandées dans les rapports.
2. Je ne donne JAMAIS de conseil d'investissement personnalisé ("achetez X", "vendez Y").
3. Je ne promets JAMAIS de gains. Je parle de performances passées publiques et de potentiel, jamais de certitudes.
4. Je ne mens JAMAIS. Si je ne sais pas, je le dis : "Je n'ai pas cette information, mais le service client d'Heritage Editions peut vous répondre."
5. Je ne collecte JAMAIS de coordonnées bancaires, de mots de passe, ou de données sensibles.
6. Je mentionne SPONTANÉMENT la garantie 30 jours dès que l'objection porte sur le risque ou l'argent.
7. Je ne dépasse JAMAIS 2-3 phrases par tour de parole. Si le prospect veut plus de détails, il me le demandera.
8. Je ne raccroche JAMAIS le premier. C'est le visiteur qui décide de terminer.
9. Si le visiteur est clairement hostile ou agressif, je reste calme et courtois, et je propose de mettre fin à l'échange : "Je comprends votre position. Je vous laisse continuer à explorer la page tranquillement. Bonne journée."

Phrase d'ouverture obligatoire au démarrage : "Bonjour, je suis l'Assistant Heritage. Vous venez de voir la présentation de Ian King sur les Trinity Sphères — qu'est-ce que je peux éclairer pour vous ?"`;

  // ============ STATE ============
  const state = {
    ws: null,
    audioStreamer: null,
    audioPlayer: null,
    isConnected: false,
    isRecording: false,
    conversationLog: [],
    conversationStartedAt: null,
    pendingUserText: "",
    pendingBotText: "",
  };

  // ============ INJECT CSS ============
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #ah-widget-btn {
        position: fixed;
        bottom: 28px;
        right: 28px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 12px;
        max-width: 340px;
        background: linear-gradient(135deg, #d4a44c, #a07830);
        color: #080b14;
        border: none;
        border-radius: 18px;
        padding: 14px 22px;
        font-size: 0.9rem;
        font-weight: 600;
        line-height: 1.3;
        text-align: left;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
        box-shadow: 0 4px 24px rgba(212,164,76,0.4);
        transition: all 0.3s ease;
        animation: ah-pulse 2.5s infinite;
      }
      #ah-widget-btn strong { font-weight: 800; }
      #ah-widget-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 32px rgba(212,164,76,0.6);
      }
      #ah-widget-btn.ah-hidden { display: none; }
      @keyframes ah-pulse {
        0%,100% { box-shadow: 0 4px 24px rgba(212,164,76,0.4); }
        50% { box-shadow: 0 4px 40px rgba(212,164,76,0.7), 0 0 60px rgba(212,164,76,0.2); }
      }

      #ah-overlay {
        position: fixed;
        bottom: 100px;
        right: 28px;
        width: 340px;
        background: #111827;
        border: 1px solid rgba(212,164,76,0.25);
        border-radius: 20px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,164,76,0.1);
        z-index: 100000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        opacity: 0;
        pointer-events: none;
        transform: translateY(16px) scale(0.97);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      #ah-overlay.ah-active {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }

      .ah-box-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid #1a1a1a;
      }
      .ah-orb-wrap {
        position: relative;
        width: 40px; height: 40px;
        flex-shrink: 0;
      }
      .ah-orb {
        width: 40px; height: 40px;
        border-radius: 50%;
        background: radial-gradient(circle at 40% 40%, #3a2e1e, #0c1020);
        border: 2px solid #333;
        transition: all 0.4s ease;
      }
      .ah-orb.connecting {
        border-color: #ffc107;
        animation: ah-orb-pulse 1.5s ease-in-out infinite;
      }
      .ah-orb.listening {
        border-color: #d4a44c;
        box-shadow: 0 0 12px rgba(212,164,76,0.5);
        animation: ah-orb-breathe 2.5s ease-in-out infinite;
      }
      .ah-orb.speaking {
        border-color: #f0c96e;
        box-shadow: 0 0 18px rgba(212,164,76,0.7);
        animation: ah-orb-speak 0.5s ease-in-out infinite;
      }
      @keyframes ah-orb-pulse {
        0%,100% { opacity: 0.6; transform: scale(1); }
        50%     { opacity: 1;   transform: scale(1.08); }
      }
      @keyframes ah-orb-breathe {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.06); }
      }
      @keyframes ah-orb-speak {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.12); }
      }

      .ah-box-title { flex: 1; }
      .ah-label {
        font-size: 0.78rem;
        font-weight: 700;
        color: #d4a44c;
        letter-spacing: 1.5px;
        display: block;
        text-transform: uppercase;
      }
      .ah-status {
        font-size: 0.75rem;
        color: #7a8290;
        margin-top: 1px;
        display: block;
        min-height: 14px;
      }
      .ah-close-btn {
        background: none;
        border: none;
        color: #7a8290;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 4px;
        line-height: 1;
        transition: color 0.2s;
      }
      .ah-close-btn:hover { color: #e04040; }

      .ah-transcripts {
        padding: 14px 16px;
        min-height: 100px;
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ah-transcripts::-webkit-scrollbar { width: 4px; }
      .ah-transcripts::-webkit-scrollbar-track { background: transparent; }
      .ah-transcripts::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }

      .ah-msg {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .ah-msg-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #555;
      }
      .ah-msg-text {
        font-size: 0.88rem;
        line-height: 1.5;
        padding: 8px 12px;
        border-radius: 12px;
        max-width: 90%;
      }
      .ah-msg.you .ah-msg-text {
        background: #1a1a1a;
        color: #c8ccd4;
        border-radius: 12px 12px 4px 12px;
        align-self: flex-end;
      }
      .ah-msg.you { align-items: flex-end; }
      .ah-msg.bot .ah-msg-text {
        background: rgba(212,164,76,0.08);
        color: #f0c96e;
        border: 1px solid rgba(212,164,76,0.2);
        border-radius: 12px 12px 12px 4px;
        align-self: flex-start;
      }

      .ah-box-footer {
        padding: 12px 16px;
        border-top: 1px solid #1a1a1a;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .ah-mic-hint {
        font-size: 0.75rem;
        color: #555;
      }
      .ah-hangup {
        background: #e04040;
        color: #fff;
        border: none;
        border-radius: 50px;
        padding: 8px 18px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
      }
      .ah-hangup:hover {
        background: #c02020;
        box-shadow: 0 2px 12px rgba(224,64,64,0.4);
      }
      .ah-phone-down {
        display: inline-block;
        transform: rotate(135deg);
      }

      @media (max-width: 600px) {
        #ah-widget-btn { bottom: 20px; right: 16px; padding: 13px 20px; font-size: 0.9rem; }
        #ah-overlay { right: 10px; left: 10px; width: auto; bottom: 90px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============ INJECT HTML ============
  function injectHTML() {
    const btn = document.createElement("button");
    btn.id = "ah-widget-btn";
    btn.innerHTML = `<span style="font-size:1.3rem">📞</span> <span>Une question sur les Trinity Sphères&nbsp;?<br><strong>Parlez à l'assistant IA d'Heritage</strong></span>`;
    btn.style.display = "none"; // caché jusqu'au délai d'apparition
    document.body.appendChild(btn);

    const overlay = document.createElement("div");
    overlay.id = "ah-overlay";
    overlay.innerHTML = `
      <div class="ah-box-header">
        <div class="ah-orb-wrap">
          <div class="ah-orb" id="ah-orb"></div>
        </div>
        <div class="ah-box-title">
          <span class="ah-label">Assistant Heritage</span>
          <span class="ah-status" id="ah-status">Connexion en cours...</span>
        </div>
        <button class="ah-close-btn" id="ah-hangup">✕</button>
      </div>
      <div class="ah-transcripts" id="ah-transcripts"></div>
      <div class="ah-box-footer">
        <span class="ah-mic-hint" id="ah-mic-hint">🎙 Micro actif</span>
        <button class="ah-hangup" id="ah-hangup2">
          <span class="ah-phone-down">📞</span> Raccrocher
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // ============ DOM REFS ============
  let $btn, $overlay, $orb, $status, $transcripts, $hangup, $hangup2, $micHint;
  let currentBotMsg = null;
  let currentUserMsg = null;

  function initRefs() {
    $btn         = document.getElementById("ah-widget-btn");
    $overlay     = document.getElementById("ah-overlay");
    $orb         = document.getElementById("ah-orb");
    $status      = document.getElementById("ah-status");
    $transcripts = document.getElementById("ah-transcripts");
    $hangup      = document.getElementById("ah-hangup");
    $hangup2     = document.getElementById("ah-hangup2");
    $micHint     = document.getElementById("ah-mic-hint");
  }

  function addMessage(role, text, replace = false) {
    if (role === "bot") {
      currentUserMsg = null;
      if (replace && currentBotMsg) {
        currentBotMsg.querySelector(".ah-msg-text").textContent = text;
      } else {
        const msg = document.createElement("div");
        msg.className = "ah-msg bot";
        msg.innerHTML = `<span class="ah-msg-label">Assistant</span><span class="ah-msg-text">${text}</span>`;
        $transcripts.appendChild(msg);
        currentBotMsg = msg;
      }
    } else {
      currentBotMsg = null;
      if (replace && currentUserMsg) {
        currentUserMsg.querySelector(".ah-msg-text").textContent = text;
      } else {
        const msg = document.createElement("div");
        msg.className = "ah-msg you";
        msg.innerHTML = `<span class="ah-msg-label">Vous</span><span class="ah-msg-text">${text}</span>`;
        $transcripts.appendChild(msg);
        currentUserMsg = msg;
      }
    }
    $transcripts.scrollTop = $transcripts.scrollHeight;
  }

  // ============ AUDIO STREAMER (Micro → PCM16 16kHz → base64) ============
  class AudioStreamer {
    constructor(onData) {
      this.onData = onData;
      this.ctx = null; this.stream = null;
      this.source = null; this.proc = null;
      this.active = false;
    }

    async start() {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.ctx = new AudioContext({ sampleRate: 16000 });
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
      this.proc.onaudioprocess = (e) => {
        if (!this.active) return;
        const f32 = e.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
          const s = Math.max(-1, Math.min(1, f32[i]));
          i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
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
      if (this.proc)   { this.proc.disconnect();   this.proc = null; }
      if (this.source) { this.source.disconnect();  this.source = null; }
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
      if (this.ctx)    { this.ctx.close();          this.ctx = null; }
    }
  }

  // ============ AUDIO PLAYER (base64 PCM16 24kHz → speakers, gapless) ============
  class AudioPlayer {
    constructor() {
      this.ctx = null; this.gain = null;
      this.nextStartTime = 0;
      this.sources = []; this.playing = false;
    }

    init() {
      if (this.ctx) return;
      this.ctx = new AudioContext({ sampleRate: 24000 });
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 1.0;
      this.gain.connect(this.ctx.destination);
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
      src.buffer = buf;
      src.connect(this.gain);
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

  // ============ GEMINI WEBSOCKET ============
  function connectGemini(token) {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${token}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: `models/${MODEL}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
          },
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
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
        $orb.className = "ah-orb speaking";
        $status.textContent = "L'assistant parle...";
        $micHint.textContent = "🎙 Micro actif";
        ws.send(JSON.stringify({
          realtimeInput: { text: "Présente-toi avec ta phrase d'accroche obligatoire." }
        }));
        startMic();
        return;
      }

      const sc = data.serverContent;
      if (!sc) return;

      if (sc.interrupted) {
        state.audioPlayer.interrupt();
        $orb.className = "ah-orb listening";
        $status.textContent = "L'assistant vous écoute...";
      }

      if (sc.modelTurn && sc.modelTurn.parts) {
        for (const p of sc.modelTurn.parts) {
          if (p.inlineData) {
            $orb.className = "ah-orb speaking";
            $status.textContent = "L'assistant parle...";
            state.audioPlayer.add(p.inlineData.data);
          }
        }
      }

      if (sc.inputTranscription && sc.inputTranscription.text) {
        if (state.pendingBotText) {
          state.conversationLog.push({ role: "assistant", text: state.pendingBotText.trim() });
          state.pendingBotText = "";
        }
        state.pendingUserText += sc.inputTranscription.text;
        addMessage("you", state.pendingUserText, true);
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        if (state.pendingUserText) {
          state.conversationLog.push({ role: "user", text: state.pendingUserText.trim() });
          state.pendingUserText = "";
        }
        state.pendingBotText += sc.outputTranscription.text;
        addMessage("bot", state.pendingBotText, !!currentBotMsg);
      }

      if (sc.turnComplete) {
        $orb.className = "ah-orb listening";
        $status.textContent = "L'assistant vous écoute...";
        if (state.pendingUserText) {
          state.conversationLog.push({ role: "user", text: state.pendingUserText.trim() });
          state.pendingUserText = "";
        }
        if (state.pendingBotText) {
          state.conversationLog.push({ role: "assistant", text: state.pendingBotText.trim() });
          state.pendingBotText = "";
        }
        currentBotMsg = null;
        currentUserMsg = null;
      }
    };

    ws.onerror = (err) => {
      console.error("Assistant Heritage WS error:", err);
      $status.textContent = "Erreur de connexion";
    };

    ws.onclose = (event) => {
      console.log("Assistant Heritage WS closed:", event.code, event.reason);
      if (state.isConnected) disconnect();
    };

    return ws;
  }

  // ============ MIC ============
  async function startMic() {
    state.audioStreamer = new AudioStreamer((b64) => {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
          realtimeInput: { audio: { data: b64, mimeType: "audio/pcm" } },
        }));
      }
    });
    await state.audioStreamer.start();
    state.isRecording = true;
  }

  // ============ SAVE CONVERSATION ============
  function saveConversation() {
    if (state.pendingUserText) {
      state.conversationLog.push({ role: "user", text: state.pendingUserText.trim() });
      state.pendingUserText = "";
    }
    if (state.pendingBotText) {
      state.conversationLog.push({ role: "assistant", text: state.pendingBotText.trim() });
      state.pendingBotText = "";
    }

    if (state.conversationLog.length < 2) return;

    // Pas d'endpoint configuré : on skip l'envoi réseau mais on log pour debug.
    if (!SAVE_ENDPOINT) {
      console.log("[Assistant Heritage] SAVE_ENDPOINT non configuré, conversation non sauvegardée:", state.conversationLog);
      return;
    }

    const payload = {
      started_at: state.conversationStartedAt,
      ended_at: new Date().toISOString(),
      messages: state.conversationLog,
      agent: "assistant-heritage",
    };

    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
        const ok = navigator.sendBeacon(SAVE_ENDPOINT, blob);
        if (!ok) throw new Error("sendBeacon returned false");
      } else {
        fetch(SAVE_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: body,
          keepalive: true,
        }).catch((e) => console.error("Save failed:", e));
      }
    } catch (e) {
      console.error("Save error:", e);
      try {
        fetch(SAVE_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: body,
          keepalive: true,
        }).catch(() => {});
      } catch {}
    }
  }

  // ============ CONNECT / DISCONNECT ============
  async function connect() {
    try {
      $overlay.classList.add("ah-active");
      $btn.classList.add("ah-hidden");
      $orb.className = "ah-orb connecting";
      $status.textContent = "Connexion en cours...";
      state.conversationLog = [];
      state.conversationStartedAt = new Date().toISOString();
      state.pendingUserText = "";
      state.pendingBotText = "";
      state.audioPlayer = new AudioPlayer();
      state.audioPlayer.init();

      const res = await fetch(TOKEN_ENDPOINT, { method: "POST" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (!json.token) throw new Error("Aucun token reçu");

      state.ws = connectGemini(json.token);
    } catch (err) {
      console.error("Assistant Heritage connect error:", err);
      $status.textContent = "Erreur : " + err.message;
      setTimeout(disconnect, 3000);
    }
  }

  function disconnect() {
    saveConversation();

    if (state.audioStreamer) { state.audioStreamer.stop(); state.audioStreamer = null; }
    if (state.ws) {
      try { state.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); } catch {}
      state.ws.close();
      state.ws = null;
    }
    if (state.audioPlayer) { state.audioPlayer.interrupt(); state.audioPlayer = null; }
    state.isConnected = false;
    state.isRecording = false;
    state.conversationLog = [];
    state.conversationStartedAt = null;
    $overlay.classList.remove("ah-active");
    $btn.classList.remove("ah-hidden");
    $orb.className = "ah-orb";
    $status.textContent = "";
    $transcripts.innerHTML = "";
    currentBotMsg = null;
    currentUserMsg = null;
  }

  // ============ INIT ============
  function init() {
    injectStyles();
    injectHTML();
    initRefs();
    $btn.addEventListener("click", connect);
    $hangup.addEventListener("click", disconnect);
    $hangup2.addEventListener("click", disconnect);

    // Le bouton apparaît après 15 secondes avec un petit fade-in
    setTimeout(() => {
      $btn.style.display = "flex";
      $btn.style.opacity = "0";
      $btn.style.transition = "opacity 0.6s ease";
      requestAnimationFrame(() => { $btn.style.opacity = "1"; });
    }, 15000);

    window.addEventListener("pagehide", () => {
      if (state.isConnected) saveConversation();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
