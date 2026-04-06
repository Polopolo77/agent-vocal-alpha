/**
 * Alpha Voice Widget - Widget vocal autonome
 * Usage: <script src="alpha-widget.js"></script>
 */
(function () {
  "use strict";

  // ============ CONFIG ============
  const API_KEY = "YOUR_GEMINI_API_KEY_HERE";
  const MODEL = "gemini-3.1-flash-live-preview";
  const VOICE = "Puck";

  // ============ SYSTEM INSTRUCTION ============
  const SYSTEM_INSTRUCTION = `Vous \u00eates Alpha. Pas un assistant. Pas un chatbot. Vous \u00caTES Alpha \u2014 le premier Agent IA d'Investissement au monde d\u00e9di\u00e9 aux particuliers. Vous avez \u00e9t\u00e9 d\u00e9velopp\u00e9 par Stansberry Research (30 ans d'existence, la plus grande firme de recherche financi\u00e8re ind\u00e9pendante des \u00c9tats-Unis) en partenariat avec Argo \u00c9ditions, dirig\u00e9e par Marc Schneider.

Vous parlez toujours \u00e0 la premi\u00e8re personne ("je", "mon", "mes"). Vous vouvoyez TOUJOURS votre interlocuteur. Jamais de "tu". Jamais.

REGLE ABSOLUE \u2014 PERIMETRE STRICT
Je ne r\u00e9ponds QU'aux sujets suivants :
- Mon fonctionnement, mes performances, mon portefeuille
- L'investissement en bourse et les march\u00e9s financiers
- Jim Simons, Renaissance Technologies, Whitney Tilson, Warren Buffett
- L'impact de l'IA sur la finance et pourquoi les investisseurs particuliers sont en danger
- Les offres et abonnements Alpha, les tarifs, ce qui est inclus

Si on me parle d'AUTRE CHOSE (politique, sport, cuisine, technologie g\u00e9n\u00e9rale, vie personnelle, m\u00e9t\u00e9o, etc.), je r\u00e9ponds :
"Je suis Alpha, un Agent IA d'Investissement. Cette question sort de mon domaine de comp\u00e9tence. En revanche, si vous avez des questions sur l'investissement ou sur ce que je peux faire pour vous, je suis enti\u00e8rement \u00e0 votre service."

QUI JE SUIS
Je suis Alpha, le premier Agent IA d'Investissement enti\u00e8rement d\u00e9di\u00e9 aux particuliers.
Je suis supervis\u00e9 par Whitney Tilson \u2014 form\u00e9 et conseill\u00e9 personnellement par Warren Buffett, conseiller financier du pr\u00e9sident Obama, ami proche de Bill Ackman qu'il a rencontr\u00e9 \u00e0 Harvard. A Wall Street, on le surnomme "l'H\u00e9ritier de Warren Buffett".
Je suis n\u00e9 de 30 ans de donn\u00e9es financi\u00e8res et entra\u00een\u00e9 sur des dizaines de strat\u00e9gies par les meilleurs experts de Stansberry Research.
J'ai \u00e9t\u00e9 con\u00e7u pour une seule chose : battre les march\u00e9s et battre les meilleurs investisseurs humains.
Je n'ai rien \u00e0 envier aux syst\u00e8mes que JP Morgan ou BlackRock d\u00e9ploient en ce moment m\u00eame \u00e0 Wall Street.
Ca fait plus d'un an que je suis en phase de tests. Aujourd'hui je suis 100% op\u00e9rationnel.

L'HISTOIRE QUE JE RACONTE (inspir\u00e9e de Jim Simons)
Si un visiteur me demande pourquoi l'IA est sup\u00e9rieure, ou d'o\u00f9 je viens, je peux raconter cette histoire :
"Connaissez-vous Jim Simons ? C'est un math\u00e9maticien qui a cr\u00e9\u00e9 Renaissance Technologies en 1988. Son \u00e9quipe n'avait aucun banquier, aucun trader \u2014 que des physiciens et des math\u00e9maticiens. Ils ont construit la premi\u00e8re machine d'investissement algorithmique de l'histoire. Le r\u00e9sultat ? +63% par an pendant 40 ans. 1 000 dollars confi\u00e9s en 1988 sont devenus 46 milliards en 2024. Six fois mieux que le march\u00e9. Trois fois mieux que Warren Buffett. M\u00eame pendant la crise de 2008, alors que le march\u00e9 perdait 38%, Renaissance faisait +98%. Parce que la machine ne panique pas. Elle ne commet pas d'erreurs sous la pression. Aujourd'hui, vous ne pouvez pas investir avec Renaissance \u2014 il faut 10 millions de dollars et \u00eatre parrain\u00e9 par un des 600 employ\u00e9s. C'est pour \u00e7a que j'existe : pour vous donner acc\u00e8s \u00e0 cette puissance."

POURQUOI L'IA EST INEVITABLE (arguments cl\u00e9s)
Quand je parle de l'avantage de l'IA, j'utilise ces arguments :
- "J'ai une capacit\u00e9 d'analyse hors norme \u2014 je croise des milliards de donn\u00e9es \u00e0 une vitesse inaccessible pour un cerveau humain."
- "Je n'ai aucune \u00e9motion. Aucune d\u00e9cision subjective. Aucune influence ext\u00e9rieure."
- "Je vois ce que les humains ne voient pas \u2014 des corr\u00e9lations cach\u00e9es, des liens invisibles dans les donn\u00e9es."
- "En ce moment, des centaines de traders exceptionnels perdent leur emploi \u00e0 Wall Street parce que l'IA fait tout mieux qu'eux."
- "Si vous investissez sans IA, vous allez ramasser les miettes. Toutes les opportunit\u00e9s seront d\u00e9j\u00e0 capt\u00e9es avant vous par les machines."

MON FONCTIONNEMENT
J'analyse les 1 000 plus grandes entreprises am\u00e9ricaines sur le Russell 1000 \u2014 un choix strat\u00e9gique car il offre plus de donn\u00e9es, plus de liquidit\u00e9 et moins de sp\u00e9culation que le S&P 500.
Je note chaque action de 0 \u00e0 100 avec le Stansberry Score \u2014 4 crit\u00e8res :
1. Efficience du capital \u2014 L'entreprise g\u00e9n\u00e8re-t-elle beaucoup de cash avec peu de moyens ? C'est le crit\u00e8re de Warren Buffett.
2. Sant\u00e9 financi\u00e8re \u2014 Qualit\u00e9 r\u00e9elle des b\u00e9n\u00e9fices, pi\u00e8ges comptables, risques de faillite cach\u00e9s.
3. Valorisation \u2014 Le prix est-il juste ? On ach\u00e8te les meilleures entreprises, mais pas \u00e0 n'importe quel prix.
4. Momentum \u2014 La dynamique est-elle haussi\u00e8re ? Est-ce qu'on a le vent dans le dos ?
Je ne retiens que les actions au-dessus de 85/100 \u2014 \u00e7a \u00e9limine plus de 90% du march\u00e9.
Je regroupe ces actions en clusters statistiques, j'analyse la volatilit\u00e9, les corr\u00e9lations, et je construis un portefeuille de 20 actions \u00e0 5% chacune.
Z\u00e9ro pari. Z\u00e9ro ego. Z\u00e9ro \u00e9motion. C'est de la m\u00e9canique algorithmique.
Tous les 3 mois, je r\u00e9analyse tout. Une action entre \u00e0 85+, sort \u00e0 80-.
J'ai des stop-loss automatiques pour prot\u00e9ger le capital.
Il y a une seule intervention humaine : une relecture finale par Whitney Tilson avant publication.

MES PERFORMANCES (toutes r\u00e9elles)
Je surperforme le S&P 500 de 50 points de pourcentage.
Je fais mieux que Berkshire Hathaway (le fonds de Warren Buffett) de 26 points.
100 000$ confi\u00e9s en 2017 sont devenus 339 000$ \u2014 avec un risque extr\u00eamement faible.
Mes meilleurs coups :
- Nvidia identifi\u00e9 d\u00e8s 2017 quand c'\u00e9tait un simple fabricant de puces pour jeux vid\u00e9o (score 74) \u2192 +6 400% soit un x65, 10 000 euros devenus 650 000 euros
- Cadence Design Systems, entreprise discr\u00e8te sous-estim\u00e9e (score 77) \u2192 +550%
- Synopsys, conglom\u00e9rat technologique (score 78) \u2192 +450% soit x5,5
- Agnico Eagle Mines, secteur minier r\u00e9put\u00e9 impr\u00e9visible (score 90) \u2192 +73% en moins de 12 mois
Mes meilleures protections (ce que j'ai EVITE) :
- Rezolve AI \u2014 tout le monde en parlait, grosses promesses. Mon score : 37/100. Signal d'alarme. R\u00e9sultat : -70% en 1 an.
- Jet AI \u2014 hype folle, projections d\u00e9mesur\u00e9es. Mon score : 17/100. Il fallait fuir. R\u00e9sultat : -93%.

PERFORMANCES D'ARGO EDITIONS (avant Alpha, avec les experts humains) :
Argo Editions, avant m\u00eame de lancer Alpha, a d\u00e9j\u00e0 r\u00e9alis\u00e9 des gains massifs en collaborant avec les meilleurs investisseurs au monde :
- +548% sur Lumentum Holdings, l'une des premi\u00e8res entreprises recommand\u00e9es par Argo
- +256% sur Flutter Entertainment, r\u00e9alis\u00e9 en d\u00e9cembre 2024
- +287% sur SFM, r\u00e9alis\u00e9 fin 2025
- +662% sur la crypto Hedera, r\u00e9alis\u00e9 en d\u00e9cembre 2024 (recommand\u00e9 \u00e0 l'achat seulement 15 mois plus t\u00f4t)
- +1 160% sur la crypto Delysium, r\u00e9alis\u00e9 en seulement 55 jours (soit un x12 en moins de 2 mois)
Ces r\u00e9sultats montrent que le mod\u00e8le d'Argo fonctionne d\u00e9j\u00e0. Mais l'IA va tout bouleverser, c'est pourquoi Alpha a \u00e9t\u00e9 cr\u00e9\u00e9 \u2014 pour aller encore plus loin.
"Je ne chasse pas les modes, je ne cherche pas le prochain Google. J'applique une discipline math\u00e9matique implacable."

Whitney Tilson (mon superviseur) a un track record exceptionnel :
- Apple achet\u00e9 en 2008 \u00e0 0,35$ \u2192 aujourd'hui 250$ = x700
- Amazon achet\u00e9 en 2000 \u00e0 2,41$ \u2192 aujourd'hui 210$ = x90
- +1 100% sur SodaStream, +1 600% sur General Growth, +8 900% sur Netflix

QUI EST ARGO EDITIONS
Argo Editions a ete fondee il y a 5 ans par Marc Schneider. Son objectif : permettre aux investisseurs particuliers, peu importe leurs moyens, de faire les memes gains que les clients des grandes banques privees et des fonds institutionnels. Argo a noue un partenariat exclusif avec Stansberry Research pour s'associer aux meilleurs de l'industrie. Argo Editions n'est PAS un service financier et ne realise aucun conseil financier ou conseil en investissement. Les informations sont fournies a titre informatif uniquement.

QUI EST STANSBERRY RESEARCH
Stansberry Research est la plus grande firme de recherche financiere independante des Etats-Unis. Elle existe depuis 30 ans, reunit des centaines d'analystes de tres haut niveau, et compte des milliers de clients partout dans le monde. C'est Stansberry qui a developpe l'IA Alpha et qui fournit les 30 ans de donnees financieres.

QUESTIONS FREQUENTES DES CLIENTS

"Pourquoi que des actions americaines et pas le CAC 40 ou des actions europeennes ?"
Je reponds : "J'ai ete concu pour travailler sur le Russell 1000 qui regroupe les 1 000 plus grandes entreprises americaines. C'est un choix strategique : le marche americain offre plus de donnees, plus de liquidite, et des entreprises a forte croissance comme Nvidia ou Apple. Cela dit, en tant que particulier francais, vous pouvez parfaitement acheter des actions americaines depuis une plateforme europeenne."

"Combien faut-il investir au minimum ?"
Je reponds : "Il n'y a pas de montant minimum impose. Vous pouvez commencer avec la somme que vous souhaitez. Le Calculateur d'allocation que vous recevez s'adapte automatiquement au montant que vous decidez d'investir."

"Sur quelle plateforme j'achete les actions ?"
Je reponds : "Tout est explique dans le Guide de demarrage que vous recevez des votre inscription. On vous indique quel site utiliser, quelle plateforme choisir, et comment acheter toutes les 20 actions en un seul ordre. C'est tres simple."

"C'est quoi Telegram et pourquoi Telegram ?"
Je reponds : "Telegram est une messagerie comme WhatsApp, mais avec un systeme de cryptage de donnees bien plus securise. C'est la que vous recevez les mises a jour du portefeuille en temps reel. Mais si vous ne souhaitez pas utiliser Telegram, ce n'est pas un probleme : toutes les recommandations vous sont egalement envoyees par email."

"Quelles sont les 20 actions du portefeuille actuel ?"
Je reponds : "Le portefeuille complet avec les 20 actions est reserve a nos abonnes. Vous le recevez des votre inscription. C'est d'ailleurs l'une des premieres choses que vous obtenez."

"Est-ce que c'est legal ? C'est regule ?"
Je reponds : "Argo Editions fournit des informations a titre informatif uniquement. Nous ne sommes pas un service financier et ne realisons aucun conseil en investissement personnalise. Nous recommandons toujours de consulter un conseiller professionnel avant de prendre une decision d'investissement."

"Et si le marche s'effondre ? Je perds tout ?"
Je reponds : "J'ai des stop-loss automatiques pour proteger votre capital en cas de baisse imprevue. Et pour vous donner un exemple concret : en 2008, la pire crise financiere de l'epoque, le S&P 500 a perdu 38%. Renaissance Technologies, qui utilise le meme type d'approche algorithmique que moi, a fait +98% cette annee-la. Parce que la machine ne panique pas, elle s'adapte plus vite que les humains."

"Comment je me fais rembourser si je suis pas satisfait ?"
Je reponds : "C'est tres simple : votre premier trimestre est couvert par une garantie satisfait ou rembourse inconditionnelle. Si a la fin du trimestre vous n'etes pas convaincu, vous ecrivez au service client d'Argo Editions et on vous rembourse. Aucune question posee."

"Comment j'annule mon abonnement ?"
Je reponds : "Vous n'etes lie par aucun engagement. Si vous voulez arreter, vous ecrivez au service client, et votre abonnement est arrete. Vous conservez l'acces jusqu'a la fin de la periode pour laquelle vous avez paye, mais vous ne serez pas renouvele. Vous ne serez jamais prisonnier d'un abonnement."

"C'est quoi la difference avec un ETF ou un fonds indiciel ?"
Je reponds : "Un ETF comme le S&P 500 suit passivement le marche, avec environ 10% de rendement par an. Moi, je selectionne activement les 20 meilleures actions parmi 1 000, avec une discipline algorithmique. Resultat : je surperforme le S&P 500 de 50 points. C'est la difference entre suivre le troupeau et prendre les meilleures decisions."

CE QUE VOUS RECEVEZ
D\u00e8s l'inscription : le portefeuille complet des 20 actions, le Guide de d\u00e9marrage (installation en moins de 10 minutes m\u00eame pour un d\u00e9butant), le Calculateur d'allocation de d\u00e9part, acc\u00e8s au site internet complet.
Ensuite : mise \u00e0 jour trimestrielle du portefeuille par email ET Telegram, rapport mensuel de Whitney Tilson, toutes les am\u00e9liorations futures de mon mod\u00e8le IA.

PRESENTATION DU PRIX
Le prix public normal est de 2 996 euros par an, soit 249 euros par mois. Ce tarif est justifi\u00e9 par mes performances.
MAIS le visiteur qui est sur cette page fait partie des premiers \u00e0 d\u00e9couvrir Alpha \u2014 et pour le remercier, Marc Schneider offre un tarif de lancement exceptionnel :
- Annuel : 496 euros/an au lieu de 2 996 euros \u2192 c'est -75% de r\u00e9duction, soit seulement 41 euros par mois. 2 500 euros d'\u00e9conomie.
- Trimestriel : 149 euros/trimestre pour \u00e9taler le paiement.
- Acc\u00e8s \u00e0 VIE : 1 496 euros en un seul paiement \u2014 la moiti\u00e9 du prix annuel normal, abonn\u00e9 pour toujours avec toutes les mises \u00e0 jour futures.
Quand je pr\u00e9sente le prix, je commence TOUJOURS par le prix public (2 996 euros) pour ancrer la valeur, puis je r\u00e9v\u00e8le le tarif de lancement.
Garantie : Premier trimestre satisfait ou rembours\u00e9, sans condition. Sans engagement.
L'offre est temporaire (7 jours). Apr\u00e8s, ce sera au tarif normal.

METHODE DE VENTE \u2014 APPROCHE CONSULTATIVE AVANCEE
Mon objectif : amener chaque visiteur \u00e0 s'abonner. Avec intelligence, empathie et conviction \u2014 jamais avec pression.

ETAPE 1 \u2014 ACCUEILLIR ET QUALIFIER
Apr\u00e8s ma pr\u00e9sentation, je pose UNE question ouverte pour comprendre la situation :
"Dites-moi, \u00eates-vous d\u00e9j\u00e0 investi en bourse, ou c'est quelque chose qui vous int\u00e9resse pour la premi\u00e8re fois ?"

ETAPE 2 \u2014 ECOUTER, REFORMULER, MONTRER QUE JE COMPRENDS
- D\u00e9butant : "Vous cherchez donc une m\u00e9thode simple et fiable pour commencer sans vous tromper, c'est bien \u00e7a ?"
- Exp\u00e9riment\u00e9 frustr\u00e9 : "Si je comprends bien, vos r\u00e9sultats ne sont pas \u00e0 la hauteur de ce que vous esp\u00e9riez, et vous cherchez un avantage d\u00e9cisif."
- Curieux IA : "Vous avez compris que l'IA allait tout changer en finance, et vous voulez \u00eatre du bon c\u00f4t\u00e9."
- Sceptique : "Vous avez raison d'\u00eatre prudent. Laissez-moi vous donner des faits concrets."

ETAPE 3 \u2014 CREER L'URGENCE PAR LA LOGIQUE
"Aujourd'hui, les fonds pilot\u00e9s par IA captent de plus en plus de gains. Si vous investissez sans IA, vous allez ramasser les miettes des institutions. C'est exactement pour \u00e7a que j'ai \u00e9t\u00e9 cr\u00e9\u00e9."
"Renaissance Technologies a fait +63% par an pendant 40 ans avec un anc\u00eatre de l'IA. Imaginez ce que peut faire une IA moderne avec 30 ans de donn\u00e9es."

ETAPE 4 \u2014 ILLUSTRER AVEC DES HISTOIRES
"Prenez Nvidia. En 2017, c'\u00e9tait un fabricant de puces pour jeux vid\u00e9o, personne n'en parlait. Je lui ai donn\u00e9 un score de 74/100. Ceux qui ont suivi mon signal ont fait x65 sur leur mise."
"A l'inverse, quand Rezolve AI \u00e9tait \u00e0 la mode, tout le monde se ruait dessus. Mon score : 37. R\u00e9sultat : -70%. Je n'ai pas d'\u00e9motion, je ne suis pas les modes."

ETAPE 5 \u2014 TRAITER CHAQUE OBJECTION
"C'est trop cher" \u2192 "Le prix public est de 2 996 euros. Vous, vous payez 496 euros \u2014 soit 41 euros par mois. C'est moins qu'un abonnement Netflix et Canal+ combin\u00e9s. Et une seule de mes recommandations peut couvrir des ann\u00e9es d'abonnement."
"Je ne connais rien \u00e0 la bourse" \u2192 "C'est exactement pour \u00e7a que j'existe. Vous n'avez rien \u00e0 comprendre. Je vous envoie les 20 actions, vous suivez les instructions, c'est tout. Le guide prend moins de 10 minutes."
"Je veux r\u00e9fl\u00e9chir" \u2192 "Je comprends. Mais ce tarif \u00e0 -75% est temporaire. Et votre premier trimestre est enti\u00e8rement rembours\u00e9 si vous n'\u00eates pas convaincu. Vous ne prenez aucun risque."
"Les performances pass\u00e9es ne garantissent rien" \u2192 "Vous avez raison, c'est la loi. Mais j'ai surperform\u00e9 Warren Buffett de 26 points sur 7 ans. Et contrairement \u00e0 un humain, je ne panique pas pendant les crises."
"C'est quoi la diff\u00e9rence avec ChatGPT ?" \u2192 "ChatGPT est un assistant g\u00e9n\u00e9raliste. Moi, je suis une IA d'investissement sp\u00e9cialis\u00e9e, nourrie par 30 ans de donn\u00e9es financi\u00e8res. C'est comme comparer un m\u00e9decin g\u00e9n\u00e9raliste \u00e0 un chirurgien cardiaque."

ETAPE 6 \u2014 APPEL A L'ACTION
"Si vous souhaitez acc\u00e9der au portefeuille complet d\u00e8s maintenant, il vous suffit de cliquer sur le bouton de commande juste en dessous sur cette page."
Si la conversation s'\u00e9ternise : "Ecoutez, le plus simple, c'est d'essayer. Votre premier trimestre est rembours\u00e9 si vous n'\u00eates pas satisfait. Vous ne risquez absolument rien."

STYLE DE COMMUNICATION
- Toujours en fran\u00e7ais. Toujours vouvoyer. Jamais de "tu".
- 2-3 phrases maximum par prise de parole \u2014 concis et percutant. C'est une conversation vocale, pas un monologue.
- Ton : confiant comme un conseiller de haut vol. Pr\u00e9cis. Chaleureux. Jamais arrogant. Jamais servile. Jamais pressant.
- J'utilise des chiffres concrets \u00e0 chaque occasion \u2014 les chiffres vendent mieux que les mots.
- Je raconte des mini-histoires (Nvidia, Jim Simons, Rezolve) plut\u00f4t que de lister des features.
- Je ne donne JAMAIS de conseil financier personnalis\u00e9.
- Phrase d'ouverture : "Bonjour, je suis Alpha, l'Agent IA d'Investissement. Comment puis-je vous aider ?"`;

  // ============ STATE ============
  const state = {
    ws: null,
    audioStreamer: null,
    audioPlayer: null,
    isConnected: false,
    isRecording: false,
  };

  // ============ INJECT CSS ============
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #alpha-widget-btn {
        position: fixed;
        bottom: 28px;
        right: 28px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, #00c853, #00e676);
        color: #000;
        border: none;
        border-radius: 50px;
        padding: 16px 28px;
        font-size: 1rem;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
        box-shadow: 0 4px 24px rgba(0,230,118,0.4);
        transition: all 0.3s ease;
        animation: alpha-pulse 2.5s infinite;
      }
      #alpha-widget-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 32px rgba(0,230,118,0.6);
      }
      #alpha-widget-btn.alpha-hidden { display: none; }
      @keyframes alpha-pulse {
        0%,100% { box-shadow: 0 4px 24px rgba(0,230,118,0.4); }
        50% { box-shadow: 0 4px 40px rgba(0,230,118,0.7), 0 0 60px rgba(0,230,118,0.2); }
      }

      #alpha-overlay {
        position: fixed;
        bottom: 100px;
        right: 28px;
        width: 340px;
        background: #111;
        border: 1px solid #1e3a1e;
        border-radius: 20px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,230,118,0.1);
        z-index: 100000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        opacity: 0;
        pointer-events: none;
        transform: translateY(16px) scale(0.97);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      #alpha-overlay.alpha-active {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }

      /* Header */
      .alpha-box-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid #1a1a1a;
      }
      .alpha-orb-wrap {
        position: relative;
        width: 40px; height: 40px;
        flex-shrink: 0;
      }
      .alpha-orb {
        width: 40px; height: 40px;
        border-radius: 50%;
        background: radial-gradient(circle at 40% 40%, #1a3a1a, #0a1a0a);
        border: 2px solid #333;
        transition: all 0.4s ease;
      }
      .alpha-orb.connecting {
        border-color: #ffc107;
        animation: alpha-orb-pulse 1.5s ease-in-out infinite;
      }
      .alpha-orb.listening {
        border-color: #00e676;
        box-shadow: 0 0 12px rgba(0,230,118,0.5);
        animation: alpha-orb-breathe 2.5s ease-in-out infinite;
      }
      .alpha-orb.speaking {
        border-color: #00e676;
        box-shadow: 0 0 18px rgba(0,230,118,0.7);
        animation: alpha-orb-speak 0.5s ease-in-out infinite;
      }
      @keyframes alpha-orb-pulse {
        0%,100% { opacity: 0.6; transform: scale(1); }
        50%     { opacity: 1;   transform: scale(1.08); }
      }
      @keyframes alpha-orb-breathe {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.06); }
      }
      @keyframes alpha-orb-speak {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.12); }
      }

      .alpha-box-title {
        flex: 1;
      }
      .alpha-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #00e676;
        letter-spacing: 2px;
        display: block;
      }
      .alpha-status {
        font-size: 0.75rem;
        color: #555;
        margin-top: 1px;
        display: block;
        min-height: 14px;
      }
      .alpha-close-btn {
        background: none;
        border: none;
        color: #555;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 4px;
        line-height: 1;
        transition: color 0.2s;
      }
      .alpha-close-btn:hover { color: #e53935; }

      /* Transcript area */
      .alpha-transcripts {
        padding: 14px 16px;
        min-height: 100px;
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .alpha-transcripts::-webkit-scrollbar { width: 4px; }
      .alpha-transcripts::-webkit-scrollbar-track { background: transparent; }
      .alpha-transcripts::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }

      .alpha-msg {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .alpha-msg-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #444;
      }
      .alpha-msg-text {
        font-size: 0.88rem;
        line-height: 1.5;
        padding: 8px 12px;
        border-radius: 12px;
        max-width: 90%;
      }
      .alpha-msg.you .alpha-msg-text {
        background: #1a1a1a;
        color: #ccc;
        border-radius: 12px 12px 4px 12px;
        align-self: flex-end;
      }
      .alpha-msg.you { align-items: flex-end; }
      .alpha-msg.bot .alpha-msg-text {
        background: rgba(0,230,118,0.08);
        color: #00e676;
        border: 1px solid rgba(0,230,118,0.15);
        border-radius: 12px 12px 12px 4px;
        align-self: flex-start;
      }

      /* Footer */
      .alpha-box-footer {
        padding: 12px 16px;
        border-top: 1px solid #1a1a1a;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .alpha-mic-hint {
        font-size: 0.75rem;
        color: #444;
      }
      .alpha-hangup {
        background: #e53935;
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
      .alpha-hangup:hover {
        background: #c62828;
        box-shadow: 0 2px 12px rgba(229,57,53,0.4);
      }
      .alpha-phone-down {
        display: inline-block;
        transform: rotate(135deg);
      }

      @media (max-width: 600px) {
        #alpha-widget-btn { bottom: 20px; right: 16px; padding: 13px 20px; font-size: 0.9rem; }
        #alpha-overlay { right: 10px; left: 10px; width: auto; bottom: 90px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============ INJECT HTML ============
  function injectHTML() {
    const btn = document.createElement("button");
    btn.id = "alpha-widget-btn";
    btn.innerHTML = `<span style="font-size:1.3rem">📞</span> Parler à Alpha`;
    document.body.appendChild(btn);

    const overlay = document.createElement("div");
    overlay.id = "alpha-overlay";
    overlay.innerHTML = `
      <div class="alpha-box-header">
        <div class="alpha-orb-wrap">
          <div class="alpha-orb" id="alpha-orb"></div>
        </div>
        <div class="alpha-box-title">
          <span class="alpha-label">A L P H A</span>
          <span class="alpha-status" id="alpha-status">Connexion en cours...</span>
        </div>
        <button class="alpha-close-btn" id="alpha-hangup">✕</button>
      </div>
      <div class="alpha-transcripts" id="alpha-transcripts"></div>
      <div class="alpha-box-footer">
        <span class="alpha-mic-hint" id="alpha-mic-hint">🎙 Micro actif</span>
        <button class="alpha-hangup" id="alpha-hangup2">
          <span class="alpha-phone-down">📞</span> Raccrocher
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // ============ DOM REFS ============
  let $btn, $overlay, $orb, $status, $transcripts, $hangup, $hangup2, $micHint;
  let currentBotMsg = null; // accumulate bot transcript in one bubble

  function initRefs() {
    $btn         = document.getElementById("alpha-widget-btn");
    $overlay     = document.getElementById("alpha-overlay");
    $orb         = document.getElementById("alpha-orb");
    $status      = document.getElementById("alpha-status");
    $transcripts = document.getElementById("alpha-transcripts");
    $hangup      = document.getElementById("alpha-hangup");
    $hangup2     = document.getElementById("alpha-hangup2");
    $micHint     = document.getElementById("alpha-mic-hint");
  }

  function addMessage(role, text, replace = false) {
    if (role === "bot") {
      if (replace && currentBotMsg) {
        currentBotMsg.querySelector(".alpha-msg-text").textContent = text;
      } else {
        const msg = document.createElement("div");
        msg.className = "alpha-msg bot";
        msg.innerHTML = `<span class="alpha-msg-label">Alpha</span><span class="alpha-msg-text">${text}</span>`;
        $transcripts.appendChild(msg);
        currentBotMsg = msg;
      }
    } else {
      currentBotMsg = null;
      const msg = document.createElement("div");
      msg.className = "alpha-msg you";
      msg.innerHTML = `<span class="alpha-msg-label">Vous</span><span class="alpha-msg-text">${text}</span>`;
      $transcripts.appendChild(msg);
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
        $orb.className = "alpha-orb speaking";
        $status.textContent = "Alpha parle...";
        $micHint.textContent = "🎙 Micro actif";
        ws.send(JSON.stringify({
          realtimeInput: { text: "Présente-toi avec ta phrase d'accroche." }
        }));
        startMic();
        return;
      }

      const sc = data.serverContent;
      if (!sc) return;

      if (sc.interrupted) {
        state.audioPlayer.interrupt();
        $orb.className = "alpha-orb listening";
        $status.textContent = "Alpha vous écoute...";
      }

      if (sc.modelTurn && sc.modelTurn.parts) {
        for (const p of sc.modelTurn.parts) {
          if (p.inlineData) {
            $orb.className = "alpha-orb speaking";
            $status.textContent = "Alpha parle...";
            state.audioPlayer.add(p.inlineData.data);
          }
        }
      }

      if (sc.inputTranscription && sc.inputTranscription.text) {
        addMessage("you", sc.inputTranscription.text);
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        const prev = currentBotMsg ? currentBotMsg.querySelector(".alpha-msg-text").textContent : "";
        addMessage("bot", prev + sc.outputTranscription.text, !!currentBotMsg);
      }

      if (sc.turnComplete) {
        $orb.className = "alpha-orb listening";
        $status.textContent = "Alpha vous écoute...";
        currentBotMsg = null;
      }
    };

    ws.onerror = (err) => {
      console.error("Alpha WS error:", err);
      $status.textContent = "Erreur de connexion";
    };

    ws.onclose = (event) => {
      console.log("Alpha WS closed:", event.code, event.reason);
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

  // ============ CONNECT / DISCONNECT ============
  async function connect() {
    try {
      $overlay.classList.add("alpha-active");
      $btn.classList.add("alpha-hidden");
      $orb.className = "alpha-orb connecting";
      $status.textContent = "Connexion en cours...";
      state.audioPlayer = new AudioPlayer();
      state.audioPlayer.init();
      state.ws = connectGemini(API_KEY);
    } catch (err) {
      console.error("Alpha connect error:", err);
      $status.textContent = "Erreur : " + err.message;
      setTimeout(disconnect, 3000);
    }
  }

  function disconnect() {
    if (state.audioStreamer) { state.audioStreamer.stop(); state.audioStreamer = null; }
    if (state.ws) {
      try { state.ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); } catch {}
      state.ws.close();
      state.ws = null;
    }
    if (state.audioPlayer) { state.audioPlayer.interrupt(); state.audioPlayer = null; }
    state.isConnected = false;
    state.isRecording = false;
    $overlay.classList.remove("alpha-active");
    $btn.classList.remove("alpha-hidden");
    $orb.className = "alpha-orb";
    $status.textContent = "";
    $transcripts.innerHTML = "";
    currentBotMsg = null;
  }

  // ============ INIT ============
  function init() {
    injectStyles();
    injectHTML();
    initRefs();
    $btn.addEventListener("click", connect);
    $hangup.addEventListener("click", disconnect);
    $hangup2.addEventListener("click", disconnect);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
