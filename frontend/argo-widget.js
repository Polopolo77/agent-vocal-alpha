/**
 * Argo Voice Widget — Concierge IA Argo Éditions (multi-produits natif)
 *
 * Usage :
 *   <script src="argo-widget.js"
 *           data-backend-url="https://web-production-572b6.up.railway.app"
 *           data-agent-name="Argos"></script>
 *
 * L'agent découvre le prospect, son profil et recommande dynamiquement
 * UNE des 4 publications Argo (Actions Gagnantes, Profits Asymétriques,
 * Agent Alpha, Stratégie Haut Rendement).
 */
(function () {
  "use strict";

  // ============ CONFIG (lue depuis le <script> tag) ============
  const CURRENT_SCRIPT = document.currentScript || (function () {
    const scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();

  const DATASET = CURRENT_SCRIPT && CURRENT_SCRIPT.dataset ? CURRENT_SCRIPT.dataset : {};
  const BACKEND_URL = (DATASET.backendUrl || "https://web-production-572b6.up.railway.app").replace(/\/$/, "");
  const AGENT_NAME = DATASET.agentName || "Argos";

  const TOKEN_ENDPOINT = BACKEND_URL + "/api/token";
  const PROMPT_ENDPOINT = BACKEND_URL + "/api/prompt?agent_name=" + encodeURIComponent(AGENT_NAME);
  const PRODUCTS_ENDPOINT = BACKEND_URL + "/api/products";
  const MODEL = "gemini-3.1-flash-live-preview";
  const VOICE = "Charon";

  // Placeholders remplis après fetch du prompt et du catalog
  let SYSTEM_INSTRUCTION = "";
  // Catalog des 4 produits, indexé par product_id. Enrichi par le coach au fil de la conv.
  let CATALOG = {};
  let CURRENT_RECOMMENDED_PRODUCT = null;

  // ============ STATE ============
  const state = {
    ws: null,
    audioStreamer: null,
    audioPlayer: null,
    isConnected: false,
    isRecording: false,
    conversationLog: [],     // accumulated transcript for saving
    conversationStartedAt: null,
    sessionId: null,         // unique ID for this call session (for coach cache)
    pendingUserText: "",     // buffer for input transcription
    pendingBotText: "",      // buffer for output transcription

    // Coach state
    userTurnCount: 0,        // how many times the user has spoken
    coachDirective: null,    // latest directive from the strategist
    coachInFlight: false,    // true if a coach call is currently running
    coachPostCallReport: null, // final report for Google Sheets
  };

  // URL Google Apps Script pour enregistrer les conversations dans Google Sheets (v2 avec colonnes enrichies)
  const SAVE_ENDPOINT = "https://script.google.com/macros/s/AKfycbzC4jn42VlayMY44L6Ru3QqzJhQOI2VQW7AxE1PfhCkll8exJNSyu9l-u8_Tjj08w/exec";

  // Endpoint du coach stratège (Railway backend)
  const STRATEGIST_ENDPOINT = BACKEND_URL + "/api/strategist";

  // Mode debug : active un panneau latéral qui affiche les directives coach en temps réel
  const DEBUG_MODE = new URLSearchParams(window.location.search).get("debug") === "1";

  // ============ INJECT CSS ============
  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #heritage-widget-btn {
        position: fixed;
        bottom: 28px;
        right: 28px;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 10px;
        background: linear-gradient(135deg, #b8860b, #daa520);
        color: #000;
        border: none;
        border-radius: 50px;
        padding: 16px 28px;
        font-size: 1rem;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        cursor: pointer;
        box-shadow: 0 4px 24px rgba(218,165,32,0.4);
        transition: all 0.3s ease;
        animation: heritage-pulse 2.5s infinite;
      }
      #heritage-widget-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 32px rgba(218,165,32,0.6);
      }
      #heritage-widget-btn.heritage-hidden { display: none; }
      @keyframes heritage-pulse {
        0%,100% { box-shadow: 0 4px 24px rgba(218,165,32,0.4); }
        50% { box-shadow: 0 4px 40px rgba(218,165,32,0.7), 0 0 60px rgba(218,165,32,0.2); }
      }

      #heritage-overlay {
        position: fixed;
        bottom: 100px;
        right: 28px;
        width: 340px;
        background: #111;
        border: 1px solid #3a2e1e;
        border-radius: 20px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(218,165,32,0.1);
        z-index: 100000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        opacity: 0;
        pointer-events: none;
        transform: translateY(16px) scale(0.97);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      #heritage-overlay.heritage-active {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }

      /* Header */
      .heritage-box-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid #1a1a1a;
      }
      .heritage-orb-wrap {
        position: relative;
        width: 40px; height: 40px;
        flex-shrink: 0;
      }
      .heritage-orb {
        width: 40px; height: 40px;
        border-radius: 50%;
        background: radial-gradient(circle at 40% 40%, #3a2e1a, #1a1309);
        border: 2px solid #333;
        transition: all 0.4s ease;
      }
      .heritage-orb.connecting {
        border-color: #ffc107;
        animation: heritage-orb-pulse 1.5s ease-in-out infinite;
      }
      .heritage-orb.listening {
        border-color: #daa520;
        box-shadow: 0 0 12px rgba(218,165,32,0.5);
        animation: heritage-orb-breathe 2.5s ease-in-out infinite;
      }
      .heritage-orb.speaking {
        border-color: #daa520;
        box-shadow: 0 0 18px rgba(218,165,32,0.7);
        animation: heritage-orb-speak 0.5s ease-in-out infinite;
      }
      @keyframes heritage-orb-pulse {
        0%,100% { opacity: 0.6; transform: scale(1); }
        50%     { opacity: 1;   transform: scale(1.08); }
      }
      @keyframes heritage-orb-breathe {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.06); }
      }
      @keyframes heritage-orb-speak {
        0%,100% { transform: scale(1); }
        50%     { transform: scale(1.12); }
      }

      .heritage-box-title {
        flex: 1;
      }
      .heritage-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: #daa520;
        letter-spacing: 2px;
        display: block;
      }
      .heritage-status {
        font-size: 0.75rem;
        color: #555;
        margin-top: 1px;
        display: block;
        min-height: 14px;
      }
      .heritage-close-btn {
        background: none;
        border: none;
        color: #555;
        font-size: 1.2rem;
        cursor: pointer;
        padding: 4px;
        line-height: 1;
        transition: color 0.2s;
      }
      .heritage-close-btn:hover { color: #e53935; }

      /* Transcript area */
      .heritage-transcripts {
        padding: 14px 16px;
        min-height: 100px;
        max-height: 220px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .heritage-transcripts::-webkit-scrollbar { width: 4px; }
      .heritage-transcripts::-webkit-scrollbar-track { background: transparent; }
      .heritage-transcripts::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }

      .heritage-msg {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .heritage-msg-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #444;
      }
      .heritage-msg-text {
        font-size: 0.88rem;
        line-height: 1.5;
        padding: 8px 12px;
        border-radius: 12px;
        max-width: 90%;
      }
      .heritage-msg.you .heritage-msg-text {
        background: #1a1a1a;
        color: #ccc;
        border-radius: 12px 12px 4px 12px;
        align-self: flex-end;
      }
      .heritage-msg.you { align-items: flex-end; }
      .heritage-msg.bot .heritage-msg-text {
        background: rgba(218,165,32,0.08);
        color: #daa520;
        border: 1px solid rgba(218,165,32,0.15);
        border-radius: 12px 12px 12px 4px;
        align-self: flex-start;
      }

      /* Footer */
      .heritage-box-footer {
        padding: 12px 16px;
        border-top: 1px solid #1a1a1a;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .heritage-mic-hint {
        font-size: 0.75rem;
        color: #444;
      }
      .heritage-hangup {
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
      .heritage-hangup:hover {
        background: #c62828;
        box-shadow: 0 2px 12px rgba(229,57,53,0.4);
      }
      .heritage-phone-down {
        display: inline-block;
        transform: rotate(135deg);
      }

      /* Closing CTA (apparaît quand coach détecte signal_closing=vert) */
      .heritage-closing-cta {
        padding: 14px 16px;
        border-top: 1px solid #3a2e1e;
        background: linear-gradient(135deg, rgba(218,165,32,0.12), rgba(184,134,11,0.08));
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        animation: heritage-cta-pulse 2s infinite;
      }
      @keyframes heritage-cta-pulse {
        0%,100% { box-shadow: inset 0 0 0 1px rgba(218,165,32,0.2); }
        50% { box-shadow: inset 0 0 0 1px rgba(218,165,32,0.5); }
      }
      .heritage-closing-label {
        font-size: 0.8rem;
        color: #daa520;
        font-weight: 600;
      }
      .heritage-closing-btn {
        background: linear-gradient(135deg, #b8860b, #daa520);
        color: #000;
        border: none;
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        white-space: nowrap;
        transition: all 0.2s;
      }
      .heritage-closing-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(218,165,32,0.4);
      }

      /* Fiche produit (apparaît quand coach recommande un produit fermement) */
      .heritage-product-card {
        margin: 12px 16px 0 16px;
        padding: 12px 14px;
        background: rgba(218,165,32,0.06);
        border: 1px solid rgba(218,165,32,0.2);
        border-radius: 10px;
        font-size: 0.85rem;
      }
      .heritage-product-card h4 {
        color: #daa520;
        font-size: 0.95rem;
        margin-bottom: 4px;
      }
      .heritage-product-card p {
        color: #aaa;
        font-size: 0.8rem;
        line-height: 1.4;
      }
      .heritage-product-card .product-price {
        color: #daa520;
        font-weight: 700;
        margin-top: 4px;
      }

      /* Debug panel (uniquement si ?debug=1) */
      #heritage-debug {
        position: fixed;
        top: 20px;
        left: 20px;
        width: 380px;
        max-height: 80vh;
        background: #050505;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        z-index: 100001;
        font-family: "SF Mono", ui-monospace, "Cascadia Code", monospace;
        font-size: 0.72rem;
        color: #aaa;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .heritage-debug-header {
        padding: 10px 14px;
        background: #111;
        border-bottom: 1px solid #2a2a2a;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #daa520;
        font-weight: 700;
        font-size: 0.75rem;
        letter-spacing: 1px;
      }
      .heritage-debug-header button {
        background: none;
        border: none;
        color: #666;
        cursor: pointer;
        font-size: 1rem;
      }
      .heritage-debug-header button:hover { color: #fff; }
      .heritage-debug-body {
        padding: 12px 14px;
        overflow-y: auto;
        flex: 1;
      }
      .heritage-debug-empty {
        color: #555;
        font-style: italic;
      }
      .heritage-debug-section {
        margin-bottom: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid #1a1a1a;
      }
      .heritage-debug-section:last-child { border-bottom: none; }
      .heritage-debug-section .debug-title {
        color: #daa520;
        text-transform: uppercase;
        font-size: 0.65rem;
        letter-spacing: 1px;
        margin-bottom: 4px;
      }
      .heritage-debug-section .debug-value {
        color: #ccc;
        font-size: 0.72rem;
        line-height: 1.4;
      }
      .heritage-debug-section .debug-list {
        color: #888;
        padding-left: 14px;
      }
      .heritage-debug-log {
        color: #555;
        font-size: 0.65rem;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #1a1a1a;
      }
      .heritage-debug-log > div { padding: 2px 0; }

      @media (max-width: 600px) {
        #heritage-widget-btn { bottom: 20px; right: 16px; padding: 13px 20px; font-size: 0.9rem; }
        #heritage-overlay { right: 10px; left: 10px; width: auto; bottom: 90px; }
        #heritage-debug { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============ UTILS ============
  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ============ INJECT HTML ============
  function injectHTML() {
    const btn = document.createElement("button");
    btn.id = "heritage-widget-btn";
    btn.innerHTML = `<span style="font-size:1.3rem">📞</span> Parler à un conseiller`;
    document.body.appendChild(btn);

    // Label d'ouverture : branding uniquement (l'agent n'a pas encore choisi un produit).
    const productLabel = "CONCIERGE IA";
    const overlay = document.createElement("div");
    overlay.id = "heritage-overlay";
    overlay.innerHTML = `
      <div class="heritage-box-header">
        <div class="heritage-orb-wrap">
          <div class="heritage-orb" id="heritage-orb"></div>
        </div>
        <div class="heritage-box-title">
          <span class="heritage-label">ARGO &nbsp;·&nbsp; ${escapeHtml(productLabel)}</span>
          <span class="heritage-status" id="heritage-status">Connexion en cours...</span>
        </div>
        <button class="heritage-close-btn" id="heritage-hangup">✕</button>
      </div>
      <div class="heritage-product-card" id="heritage-product-card" style="display:none;"></div>
      <div class="heritage-transcripts" id="heritage-transcripts"></div>
      <div class="heritage-closing-cta" id="heritage-closing-cta" style="display:none;">
        <span class="heritage-closing-label">Prêt à commencer ?</span>
        <a href="https://argo-editions.com" target="_blank" rel="noopener" class="heritage-closing-btn">
          S'inscrire maintenant
        </a>
      </div>
      <div class="heritage-box-footer">
        <span class="heritage-mic-hint" id="heritage-mic-hint">🎙 Micro actif</span>
        <button class="heritage-hangup" id="heritage-hangup2">
          <span class="heritage-phone-down">📞</span> Raccrocher
        </button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Inject debug panel only if ?debug=1 in URL
    if (DEBUG_MODE) {
      const debug = document.createElement("div");
      debug.id = "heritage-debug";
      debug.innerHTML = `
        <div class="heritage-debug-header">
          <span>🔍 COACH DEBUG</span>
          <button id="heritage-debug-close">✕</button>
        </div>
        <div class="heritage-debug-body" id="heritage-debug-body">
          <div class="heritage-debug-empty">En attente du premier appel coach...</div>
        </div>
      `;
      document.body.appendChild(debug);
      document.getElementById("heritage-debug-close").addEventListener("click", () => {
        debug.style.display = "none";
      });
    }
  }

  // ============ DOM REFS ============
  let $btn, $overlay, $orb, $status, $transcripts, $hangup, $hangup2, $micHint;
  let currentBotMsg = null; // accumulate bot transcript in one bubble
  let currentUserMsg = null; // accumulate user transcript in one bubble

  function initRefs() {
    $btn         = document.getElementById("heritage-widget-btn");
    $overlay     = document.getElementById("heritage-overlay");
    $orb         = document.getElementById("heritage-orb");
    $status      = document.getElementById("heritage-status");
    $transcripts = document.getElementById("heritage-transcripts");
    $hangup      = document.getElementById("heritage-hangup");
    $hangup2     = document.getElementById("heritage-hangup2");
    $micHint     = document.getElementById("heritage-mic-hint");
  }

  function addMessage(role, text, replace = false) {
    if (role === "bot") {
      currentUserMsg = null;
      if (replace && currentBotMsg) {
        currentBotMsg.querySelector(".heritage-msg-text").textContent = text;
      } else {
        const msg = document.createElement("div");
        msg.className = "heritage-msg bot";
        msg.innerHTML = `<span class="heritage-msg-label">Alpha</span><span class="heritage-msg-text">${text}</span>`;
        $transcripts.appendChild(msg);
        currentBotMsg = msg;
      }
    } else {
      currentBotMsg = null;
      if (replace && currentUserMsg) {
        currentUserMsg.querySelector(".heritage-msg-text").textContent = text;
      } else {
        const msg = document.createElement("div");
        msg.className = "heritage-msg you";
        msg.innerHTML = `<span class="heritage-msg-label">Vous</span><span class="heritage-msg-text">${text}</span>`;
        $transcripts.appendChild(msg);
        currentUserMsg = msg;
      }
    }
    $transcripts.scrollTop = $transcripts.scrollHeight;
  }

  // ============ DEBUG PANEL ============
  const debugLogEntries = [];
  function debugLog(type, data) {
    if (!DEBUG_MODE) return;
    const ts = new Date().toLocaleTimeString();
    debugLogEntries.push({ ts, type, data });
    if (debugLogEntries.length > 30) debugLogEntries.shift();
    const logEl = document.getElementById("heritage-debug-body");
    if (logEl) renderDebugLog();
  }

  function renderDebugLog() {
    const logEl = document.getElementById("heritage-debug-body");
    if (!logEl) return;
    const logsHtml = debugLogEntries
      .slice()
      .reverse()
      .map((e) => `<div>[${e.ts}] <strong>${e.type}</strong> ${JSON.stringify(e.data).slice(0, 120)}</div>`)
      .join("");
    const currentHtml = logEl.innerHTML;
    // Only update if the log section exists, otherwise keep the full panel
    if (currentHtml.includes("heritage-debug-log")) {
      const logDiv = logEl.querySelector(".heritage-debug-log");
      if (logDiv) logDiv.innerHTML = logsHtml;
    }
  }

  function updateDebugPanel(directive) {
    if (!DEBUG_MODE) return;
    const body = document.getElementById("heritage-debug-body");
    if (!body) return;

    const disc = directive.profil_disc || {};
    const emot = directive.etat_emotionnel || {};
    const spin = directive.spin || {};
    const prod = directive.produit || {};
    const obj = directive.objections || {};
    const dir = directive.directive_prochain_tour || {};

    const esc = (s) => String(s || "").replace(/</g, "&lt;");

    body.innerHTML = `
      <div class="heritage-debug-section">
        <div class="debug-title">Profil DISC</div>
        <div class="debug-value">
          D ${disc.dominant || 0}% · I ${disc.influent || 0}% · S ${disc.stable || 0}% · C ${disc.consciencieux || 0}%<br>
          Confiance : ${disc.confiance || 0}%<br>
          <em>${esc(disc.justification)}</em>
        </div>
      </div>

      <div class="heritage-debug-section">
        <div class="debug-title">État émotionnel</div>
        <div class="debug-value">
          Chaleur : <strong>${esc(emot.chaleur)}</strong><br>
          Stress : ${esc(emot.stress)}<br>
          Confiance agent : ${esc(emot.confiance_agent)}<br>
          Évolution : ${esc(emot.evolution)}
        </div>
      </div>

      <div class="heritage-debug-section">
        <div class="debug-title">SPIN</div>
        <div class="debug-value">
          Étape actuelle : <strong>${esc(spin.etape_actuelle)}</strong><br>
          Prochaine : ${esc(spin.prochaine_etape)}<br>
          Progression : ${spin.progression_pct || 0}%
        </div>
      </div>

      <div class="heritage-debug-section">
        <div class="debug-title">Produit recommandé</div>
        <div class="debug-value">
          <strong>${esc(prod.recommande) || "aucun"}</strong> (${esc(prod.certitude)})<br>
          <em>${esc(prod.justification)}</em>
        </div>
      </div>

      <div class="heritage-debug-section">
        <div class="debug-title">Objections</div>
        <div class="debug-value">
          Évoquées : ${(obj.evoquees || []).map(esc).join(", ") || "—"}<br>
          Levées : ${(obj.levees || []).map(esc).join(", ") || "—"}<br>
          En cours : ${(obj.en_cours || []).map(esc).join(", ") || "—"}
        </div>
      </div>

      <div class="heritage-debug-section">
        <div class="debug-title">Directive prochain tour</div>
        <div class="debug-value">
          Action : <strong>${esc(dir.action_principale)}</strong><br>
          Tactique : ${esc(dir.tactique)}<br>
          Signal closing : <strong style="color:${dir.signal_closing === 'vert' ? '#0f0' : dir.signal_closing === 'orange' ? '#fa0' : '#f55'}">${esc(dir.signal_closing)}</strong><br>
          <em>${esc(dir.formulation_suggeree)}</em>
        </div>
      </div>

      <div class="heritage-debug-log"></div>
    `;
    renderDebugLog();
  }

  // ============ UI ACTIONS DÉCLENCHÉES PAR LE COACH ============
  function showClosingCta() {
    const el = document.getElementById("heritage-closing-cta");
    if (el) el.style.display = "flex";
  }

  function hideClosingCta() {
    const el = document.getElementById("heritage-closing-cta");
    if (el) el.style.display = "none";
  }

  // Construit la carte produit pour le produit actuellement recommandé par le coach.
  // `tierKey` = "A" | "B" | "C" | "D" — précise quelle offre pousser.
  function showProductCard(tierKey) {
    const el = document.getElementById("heritage-product-card");
    if (!el) return;

    const pid = CURRENT_RECOMMENDED_PRODUCT;
    const pm = pid ? CATALOG[pid] : null;
    if (!pm) return;

    const offers = pm.offers || {};
    const tier = tierKey && offers[tierKey] ? offers[tierKey] : (offers.A || Object.values(offers)[0]);
    if (!tier) return;

    const priceLabel = tier.label || (tier.price_eur + "€/" + (tier.period || "an"));
    const expert = pm.expert ? `par ${escapeHtml(pm.expert)}` : "";
    const lm = pm.lead_magnet ? `<p class="product-bonus">Bonus offert : <strong>${escapeHtml(pm.lead_magnet)}</strong></p>` : "";

    el.innerHTML = `
      <h4>${escapeHtml(pm.name || pid)}</h4>
      <p>${expert}</p>
      ${lm}
      <p class="product-price">${escapeHtml(priceLabel)}</p>
    `;
    el.style.display = "block";

    // Update the overlay label maintenant qu'un produit est révélé.
    const labelEl = document.querySelector(".heritage-label");
    if (labelEl) labelEl.textContent = `ARGO · ${(pm.name || pid).toUpperCase()}`;
  }

  function hideProductCard() {
    const el = document.getElementById("heritage-product-card");
    if (el) el.style.display = "none";
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
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
              languageCode: "fr-FR",
            },
          },
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [{
              name: "obtenir_briefing",
              description: "Appelle cette fonction pour obtenir (1) la directive tactique du coach en arrière-plan (profil DISC du prospect, chaleur, objections, action recommandée) et (2) des extraits pertinents de la lettre de vente du produit actuel pour répondre à une question factuelle précise. Exemples de queries : 'track record whitney tilson', 'prix des 4 offres', 'méthode stansberry score', 'garanties actions gagnantes', 'qui est dan ferris'.",
              parameters: {
                type: "object",
                properties: {
                  raison: {
                    type: "string",
                    description: "Query courte (3-8 mots en français) décrivant ce que tu cherches dans la lettre de vente ET/OU brève raison tactique pour laquelle tu appelles le briefing."
                  }
                },
                required: ["raison"]
              }
            }]
          }],
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
        $orb.className = "heritage-orb speaking";
        $status.textContent = `${AGENT_NAME} parle...`;
        $micHint.textContent = "🎙 Micro actif";
        ws.send(JSON.stringify({
          realtimeInput: { text: `Le prospect vient de décrocher. Tu dis EXACTEMENT cette phrase, mot pour mot, en français standard de France : "Bonjour, ici ${AGENT_NAME}, le concierge IA d'Argo Éditions. Avant d'aller plus loin, puis-je vous demander votre prénom ?". Rien d'autre. Tu attends sa réponse.` }
        }));
        startMic();
        return;
      }

      // ── TOOL CALL HANDLER ──
      // When Gemini calls obtenir_briefing, we fetch the cached coach directive
      // from the backend and send it back as a toolResponse.
      if (data.toolCall) {
        const calls = data.toolCall.functionCalls || [];
        for (const fc of calls) {
          if (fc.name === "obtenir_briefing") {
            debugLog("tool_call", { reason: fc.args?.raison || "unknown" });
            // Fetch briefing from backend (coach cache, ~10ms)
            fetch(BACKEND_URL + "/api/briefing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: state.sessionId || "default",
                query: fc.args?.raison || fc.args?.query || "",
              }),
            })
              .then((r) => r.json())
              .then((briefing) => {
                debugLog("tool_response", briefing);
                // Send the briefing back to Gemini as a toolResponse
                ws.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{
                      id: fc.id,
                      name: fc.name,
                      response: briefing,
                    }],
                  },
                }));
              })
              .catch((err) => {
                console.error("Briefing fetch failed:", err);
                // Send empty response so Gemini doesn't hang
                ws.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{
                      id: fc.id,
                      name: fc.name,
                      response: { coach: null, meta: { note: "Coach indisponible. Utilise ton propre jugement." } },
                    }],
                  },
                }));
              });
          }
        }
        return;
      }

      const sc = data.serverContent;
      if (!sc) return;

      if (sc.interrupted) {
        state.audioPlayer.interrupt();
        $orb.className = "heritage-orb listening";
        $status.textContent = `${AGENT_NAME} vous écoute...`;
      }

      if (sc.modelTurn && sc.modelTurn.parts) {
        for (const p of sc.modelTurn.parts) {
          if (p.inlineData) {
            $orb.className = "heritage-orb speaking";
            $status.textContent = `${AGENT_NAME} parle...`;
            state.audioPlayer.add(p.inlineData.data);
          }
        }
      }

      if (sc.inputTranscription && sc.inputTranscription.text) {
        // User started talking — flush any pending bot text to log first
        if (state.pendingBotText) {
          state.conversationLog.push({ role: "alpha", text: state.pendingBotText.trim() });
          state.pendingBotText = "";
        }
        state.pendingUserText += sc.inputTranscription.text;
        addMessage("you", state.pendingUserText, true);
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        // Bot started talking — this means the user turn just ended
        if (state.pendingUserText) {
          const userText = state.pendingUserText.trim();
          state.conversationLog.push({ role: "user", text: userText });
          state.pendingUserText = "";
          // Increment turn count and trigger coach if needed
          state.userTurnCount += 1;
          const decision = shouldCallCoach(userText);
          debugLog("coach_decision", { turn: state.userTurnCount, ...decision });
          if (decision.call) {
            callCoach("mid_call");
          }
          // UI Director: fast agent for cards, runs at every turn from turn 2+
          if (state.userTurnCount >= 2) callUIAgents();
        }
        state.pendingBotText += sc.outputTranscription.text;
        addMessage("bot", state.pendingBotText, !!currentBotMsg);
      }

      if (sc.turnComplete) {
        $orb.className = "heritage-orb listening";
        $status.textContent = `${AGENT_NAME} vous écoute...`;
        // Flush whatever is pending at end of turn
        if (state.pendingUserText) {
          state.conversationLog.push({ role: "user", text: state.pendingUserText.trim() });
          state.pendingUserText = "";
        }
        if (state.pendingBotText) {
          state.conversationLog.push({ role: "alpha", text: state.pendingBotText.trim() });
          state.pendingBotText = "";
        }
        currentBotMsg = null;
        currentUserMsg = null;

        // Try to inject the latest coach directive into context for next turn
        injectCoachDirectiveIfAvailable();
      }
    };

    ws.onerror = (err) => {
      console.error(`${AGENT_NAME} WS error:`, err);
      $status.textContent = "Erreur de connexion";
    };

    ws.onclose = (event) => {
      console.log(`${AGENT_NAME} WS closed:`, event.code, event.reason);
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

  // ============ COACH (stratège Gemini 2.5 Flash) ============

  // Mots-clés déclencheurs pour un appel coach à la demande entre les tours 4-6
  const COACH_TRIGGER_KEYWORDS = {
    objection: ["cher", "arnaque", "réfléchir", "pas sûr", "concurrent", "trop", "hésite", "peur", "risque", "confiance"],
    closing: ["je m'inscris", "comment faire", "je prends", "le lien", "envoyez-moi", "ok je", "d'accord je", "je me lance", "on y va", "c'est bon"],
    contradiction_candidate: ["en fait", "par contre", "mais finalement", "attendez", "en réalité"],
    difficult: ["conseil", "acheter quoi", "quelle action", "combien je dois", "personnalisé"],
  };

  // Détecte si le dernier message prospect contient un signal fort qui justifie un appel coach
  function detectCoachTrigger(userText) {
    const text = userText.toLowerCase();
    for (const category in COACH_TRIGGER_KEYWORDS) {
      for (const kw of COACH_TRIGGER_KEYWORDS[category]) {
        if (text.includes(kw)) {
          return category;
        }
      }
    }
    return null;
  }

  // Décide si on doit appeler le coach selon la stratégie hybride (Option D)
  function shouldCallCoach(userText) {
    const turn = state.userTurnCount;
    // Tours 1-2 : pas de coach (pas assez de contexte)
    if (turn <= 2) return { call: false, reason: "early_turn" };
    // Tour 3 : premier appel obligatoire (détection du profil DISC)
    if (turn === 3) return { call: true, reason: "first_profile_detection" };
    // Tour 4+ : un tour sur deux (tours pairs : 4, 6, 8, 10...)
    if (turn % 2 === 0) return { call: true, reason: "every_other_turn" };
    // Tours impairs après le 3 : pas de coach sauf signal fort
    const trigger = detectCoachTrigger(userText);
    if (trigger) return { call: true, reason: "signal_" + trigger };
    return { call: false, reason: "odd_turn_no_signal" };
  }

  // Appelle le coach en arrière-plan (non-bloquant)
  function callCoach(mode = "mid_call") {
    if (state.coachInFlight) return; // évite les appels concurrents
    state.coachInFlight = true;

    const payload = {
      history: state.conversationLog.slice(), // copie
      turn_number: state.userTurnCount,
      mode: mode,
      session_id: state.sessionId || "default",
      agent_name: AGENT_NAME,
    };

    debugLog("coach_call", { turn: state.userTurnCount, mode: mode });

    fetch(STRATEGIST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .then((directive) => {
        state.coachInFlight = false;
        if (directive && !directive.error) {
          state.coachDirective = directive;
          if (mode === "post_call") {
            state.coachPostCallReport = directive;
          }
          debugLog("coach_response", directive);
          updateDebugPanel(directive);
          handleCoachActions(directive);
        } else {
          debugLog("coach_error", directive);
        }
      })
      .catch((err) => {
        state.coachInFlight = false;
        console.error("Coach error:", err);
        debugLog("coach_error", { message: err.message });
      });
  }

  // Gère les actions visibles déclenchées par le coach (closing vert, fiche produit)
  function handleCoachActions(directive) {
    const closingSignal = directive.directive_prochain_tour?.signal_closing;
    if (closingSignal === "vert") {
      showClosingCta();
    } else {
      hideClosingCta();
    }

    // Schema multi-produits : coach renvoie produit.recommande (argo_X) + tier_recommande (A/B/C/D)
    const recommande = directive.produit?.recommande;
    const tier       = directive.produit?.tier_recommande;
    const certitude  = directive.produit?.certitude;

    // Enregistre le produit recommandé dès que certitude moyen/ferme
    if (recommande && (certitude === "moyen" || certitude === "ferme")) {
      CURRENT_RECOMMENDED_PRODUCT = recommande;
    }
    // Révèle la fiche produit seulement quand certitude ferme
    if (recommande && certitude === "ferme" && tier) {
      showProductCard(tier);
    }
  }

  // Construit le texte de directive à injecter comme "note interne" dans Gemini Live
  function buildCoachInjection() {
    const d = state.coachDirective;
    if (!d) return null;

    const parts = [];
    parts.push("[Note interne du coach, NE PAS mentionner au client]");

    if (d.profil_disc && d.profil_disc.justification) {
      const disc = d.profil_disc;
      const dominant = Math.max(disc.dominant || 0, disc.influent || 0, disc.stable || 0, disc.consciencieux || 0);
      let type = "mixte";
      if (dominant === disc.dominant) type = "Dominant";
      else if (dominant === disc.influent) type = "Influent";
      else if (dominant === disc.stable) type = "Stable";
      else if (dominant === disc.consciencieux) type = "Consciencieux";
      parts.push("Profil détecté : " + type + " (" + dominant + "%)");
    }

    if (d.etat_emotionnel?.chaleur) {
      parts.push("Chaleur : " + d.etat_emotionnel.chaleur);
    }

    if (d.produit?.recommande) {
      parts.push("Produit cible : " + d.produit.recommande + " (certitude " + (d.produit.certitude || "moyen") + ")");
    }

    if (d.objections?.en_cours && d.objections.en_cours.length > 0) {
      parts.push("Objections en cours à traiter : " + d.objections.en_cours.join(", "));
    }

    if (d.memoire?.contradictions_detectees && d.memoire.contradictions_detectees.length > 0) {
      parts.push("Contradictions à nommer respectueusement : " + d.memoire.contradictions_detectees.join(" ; "));
    }

    if (d.directive_prochain_tour?.action_principale) {
      parts.push("Action à faire : " + d.directive_prochain_tour.action_principale);
    }

    if (d.directive_prochain_tour?.formulation_suggeree) {
      parts.push("Formulation suggérée : " + d.directive_prochain_tour.formulation_suggeree);
    }

    if (d.directive_prochain_tour?.pieges_a_eviter && d.directive_prochain_tour.pieges_a_eviter.length > 0) {
      parts.push("Pièges à éviter : " + d.directive_prochain_tour.pieges_a_eviter.join(" ; "));
    }

    if (d.directive_prochain_tour?.signal_closing === "vert") {
      parts.push("SIGNAL CLOSING VERT : tu peux proposer l'inscription maintenant.");
    }

    parts.push("[Fin de la note]");

    return parts.join("\n");
  }

  // Coach directive injection is DISABLED during live conversation.
  //
  // Reason: Gemini Live interprets any text sent via realtimeInput.text or clientContent
  // as a user turn and generates a response to it. Even with "[Note interne]" prefix and
  // explicit prompt rules telling Alpha to ignore coach notes, the model still responds,
  // causing "Alpha talking to itself" bugs in the middle of real conversations.
  //
  // Instead, the coach's value is delivered through:
  //   1. Debug panel (real-time analysis visible to the developer)
  //   2. Product card (appears when coach detects ferme recommendation)
  //   3. Closing CTA button (appears when signal_closing = vert)
  //   4. Post-call report (enriched Google Sheets columns after hangup)
  //
  // Live adaptation of Alpha's behavior via the coach is not possible with the current
  // Gemini Live API. It would require a different architecture (e.g. proxy mode where
  // we intercept each turn and re-prompt Gemini with injected context, but that breaks
  // the real-time audio streaming model).
  let lastInjectedDirective = null;
  function injectCoachDirectiveIfAvailable() {
    // Intentionally a no-op. See comment above.
    return;
  }

  // ============ UI AGENTS (dossier + cards en parallèle) ============
  let uiDirectorInFlight = false;
  let lastDossierData = {};

  function callUIAgents() {
    if (uiDirectorInFlight) return;
    uiDirectorInFlight = true;

    var historySlice = state.conversationLog.slice();

    var dossierCall = fetch(BACKEND_URL + "/api/ui-dossier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: historySlice,
        previous_dossier: lastDossierData,
      }),
    }).then(function(r) { return r.json(); }).catch(function() { return {}; });

    var cardsCall = fetch(BACKEND_URL + "/api/ui-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: historySlice,
      }),
    }).then(function(r) { return r.json(); }).catch(function() { return { card: null }; });

    Promise.all([dossierCall, cardsCall]).then(function(results) {
      uiDirectorInFlight = false;
      var dossier = results[0];
      var cardsResult = results[1];

      // Dossier
      if (dossier && dossier.prenom !== undefined) {
        lastDossierData = dossier;
        debugLog("dossier_update", dossier);
      }

      // Card
      var cardData = cardsResult ? (cardsResult.card || cardsResult.card_a_afficher) : null;
      if (cardData) {
        debugLog("card_update", cardData);
      }
    }).catch(function() { uiDirectorInFlight = false; });
  }

  // ============ SAVE CONVERSATION ============
  function buildPostCallReport(report) {
    // Transforme le rapport JSON du coach en colonnes plates pour Google Sheets
    if (!report) return {};
    const disc = report.profil_disc || {};
    const emot = report.etat_emotionnel || {};
    const prod = report.produit || {};
    const obj = report.objections || {};
    const dir = report.directive_prochain_tour || {};
    const mem = report.memoire || {};

    // Profil DISC dominant
    const scores = {
      Dominant: disc.dominant || 0,
      Influent: disc.influent || 0,
      Stable: disc.stable || 0,
      Consciencieux: disc.consciencieux || 0,
    };
    let dominant = "Mixte";
    let maxScore = 0;
    for (const [k, v] of Object.entries(scores)) {
      if (v > maxScore) { maxScore = v; dominant = k; }
    }

    // Conversion détectée
    const conversion = dir.signal_closing === "vert" || emot.chaleur === "pret_a_acheter";

    // Lead score (0-100)
    const chaleurScores = { froid: 15, tiede: 40, chaud: 70, pret_a_acheter: 95 };
    const leadScore = chaleurScores[emot.chaleur] || 0;

    return {
      profil_disc_final: dominant,
      profil_disc_confiance: disc.confiance || 0,
      chaleur_finale: emot.chaleur || "inconnue",
      produit_recommande: prod.recommande || "aucun",
      produit_certitude: prod.certitude || "faible",
      objections_evoquees: (obj.evoquees || []).join(" | "),
      objections_levees: (obj.levees || []).join(" | "),
      objections_non_levees: (obj.en_cours || []).join(" | "),
      peurs_principales: (mem.peurs_exprimees || []).join(" | "),
      declarations_cles: (mem.declarations_cles || []).join(" | "),
      contradictions_detectees: (mem.contradictions_detectees || []).join(" | "),
      lead_score: leadScore,
      conversion_probable: conversion ? "oui" : "non",
      action_recommandee: dir.action_principale || "",
    };
  }

  async function generatePostCallReportFromSnapshot(snapshot) {
    // Uses snapshot to avoid race conditions with disconnect() resetting state
    try {
      const res = await fetch(STRATEGIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: snapshot.messages,
          turn_number: snapshot.turn_number,
          mode: "post_call",
          session_id: snapshot.session_id || "default",
          agent_name: AGENT_NAME,
        }),
      });
      const report = await res.json();
      if (report && !report.error) {
        return report;
      }
    } catch (err) {
      console.error("Post-call report failed:", err);
    }
    return null;
  }

  async function saveConversation() {
    // Flush any remaining pending text
    if (state.pendingUserText) {
      state.conversationLog.push({ role: "user", text: state.pendingUserText.trim() });
      state.pendingUserText = "";
    }
    if (state.pendingBotText) {
      state.conversationLog.push({ role: "alpha", text: state.pendingBotText.trim() });
      state.pendingBotText = "";
    }

    // Don't save empty or trivial conversations (only the auto intro)
    if (state.conversationLog.length < 2) return;

    // CRITICAL: snapshot the state IMMEDIATELY before the async await,
    // because disconnect() runs in parallel and will reset the state.
    const snapshot = {
      started_at: state.conversationStartedAt || new Date().toISOString(),
      ended_at: new Date().toISOString(),
      messages: state.conversationLog.slice(), // shallow copy
      turn_number: state.userTurnCount,
      session_id: state.sessionId,
      product_id: CURRENT_RECOMMENDED_PRODUCT,  // produit final recommandé (peut être null)
      agent_name: AGENT_NAME,
    };

    console.log("[Argo] saveConversation start, messages=", snapshot.messages.length, "turns=", snapshot.turn_number);

    // Generate the post-call report from the coach (async, longer wait)
    // We use a 12-second timeout: Gemini Flash usually responds in 2-4s but can spike to 8s.
    let report = null;
    const reportStart = Date.now();
    try {
      const reportPromise = generatePostCallReportFromSnapshot(snapshot);
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve("TIMEOUT"), 12000));
      report = await Promise.race([reportPromise, timeoutPromise]);
      const elapsed = Date.now() - reportStart;
      if (report === "TIMEOUT") {
        console.warn("[Argo] post-call report timeout after", elapsed, "ms");
        report = null;
      } else if (report === null) {
        console.warn("[Argo] post-call report returned null after", elapsed, "ms");
      } else {
        console.log("[Argo] post-call report received after", elapsed, "ms");
      }
    } catch (err) {
      console.error("[Argo] post-call report threw:", err);
    }

    const reportCols = buildPostCallReport(report);
    console.log("[Argo] reportCols keys:", Object.keys(reportCols).length);

    const payload = {
      started_at: snapshot.started_at,
      ended_at: snapshot.ended_at,
      messages: snapshot.messages,
      product_id: snapshot.product_id,
      agent_name: snapshot.agent_name,
      ...reportCols,
    };

    // Sauvegarde aussi en parallèle vers le backend SQLite (non bloquant, optionnel)
    try {
      fetch(BACKEND_URL + "/api/save-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          started_at: snapshot.started_at,
          ended_at: snapshot.ended_at,
          messages: snapshot.messages,
          product_id: snapshot.product_id,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {}

    // Google Apps Script requires text/plain Content-Type to avoid CORS preflight
    const body = JSON.stringify(payload);
    console.log("[Argo] sending payload, size=", body.length, "bytes, has reportCols=", Object.keys(reportCols).length > 0);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });
        const ok = navigator.sendBeacon(SAVE_ENDPOINT, blob);
        if (!ok) throw new Error("sendBeacon returned false");
        console.log("[Argo] sendBeacon OK");
      } else {
        fetch(SAVE_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: body,
          keepalive: true,
        }).then(() => console.log("[Argo] fetch keepalive OK"))
          .catch((e) => console.error("[Argo] Save failed:", e));
      }
    } catch (e) {
      console.error("[Argo] Save error:", e);
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
      $overlay.classList.add("heritage-active");
      $btn.classList.add("heritage-hidden");
      $orb.className = "heritage-orb connecting";
      $status.textContent = "Connexion en cours...";
      // Reset conversation log
      state.conversationLog = [];
      state.conversationStartedAt = new Date().toISOString();
      state.sessionId = "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
      state.pendingUserText = "";
      state.pendingBotText = "";
      // Reset coach state
      state.userTurnCount = 0;
      state.coachDirective = null;
      state.coachInFlight = false;
      state.coachPostCallReport = null;
      lastInjectedDirective = null;
      hideClosingCta();
      hideProductCard();
      state.audioPlayer = new AudioPlayer();
      state.audioPlayer.init();

      // Charger le prompt système universel (multi-produits) du backend
      if (!SYSTEM_INSTRUCTION) {
        const pRes = await fetch(PROMPT_ENDPOINT);
        const pJson = await pRes.json();
        if (pJson.error) throw new Error("Prompt : " + pJson.error);
        SYSTEM_INSTRUCTION = pJson.prompt;
      }

      // Charger le catalog des 4 produits (pour showProductCard quand coach tranche)
      if (Object.keys(CATALOG).length === 0) {
        try {
          const cRes = await fetch(PRODUCTS_ENDPOINT);
          const cJson = await cRes.json();
          for (const p of (cJson.products || [])) {
            CATALOG[p.product_id] = p;
          }
        } catch (catErr) {
          console.warn("Failed to load product catalog:", catErr);
        }
      }

      // Fetch API key from backend
      const res = await fetch(TOKEN_ENDPOINT, { method: "POST" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (!json.token) throw new Error("Aucun token reçu");

      state.ws = connectGemini(json.token);
    } catch (err) {
      console.error(`${AGENT_NAME} connect error:`, err);
      $status.textContent = "Erreur : " + err.message;
      setTimeout(disconnect, 3000);
    }
  }

  function disconnect() {
    // Save conversation BEFORE cleaning up state (async with post-call report)
    saveConversation().catch((e) => console.error("saveConversation error:", e));

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
    state.userTurnCount = 0;
    state.coachDirective = null;
    state.coachInFlight = false;
    lastInjectedDirective = null;
    $overlay.classList.remove("heritage-active");
    $btn.classList.remove("heritage-hidden");
    $orb.className = "heritage-orb";
    $status.textContent = "";
    $transcripts.innerHTML = "";
    currentBotMsg = null;
    currentUserMsg = null;
    hideClosingCta();
    hideProductCard();
  }

  // ============ INIT ============
  function init() {
    injectStyles();
    injectHTML();
    initRefs();
    $btn.addEventListener("click", connect);
    $hangup.addEventListener("click", disconnect);
    $hangup2.addEventListener("click", disconnect);

    // Save conversation if user closes the tab/page during an active call
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
