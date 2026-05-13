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
  const TEXT_MODEL = "gemini-2.5-flash";        // Rapide ET intelligent (Pro était trop lent)
  const LIVE_MODEL = "gemini-3.1-flash-live-preview";  // Modèle Live pour la voix
  const VOICE = "Charon";                        // Voix grave et chaleureuse

  // Sauvegarde des conversations sur le backend Railway (SQLite)
  const SAVE_ENDPOINT = BACKEND_URL + "/api/save-conversation";
  const AGENT_PRODUCT_ID = "assistant-argo";

  // ============ SYSTEM INSTRUCTION (fetched from backend, hidden from JS source) ============
  const PROMPT_ENDPOINT = BACKEND_URL + "/api/assistant-argo-prompt";
  let SYSTEM_INSTRUCTION = "";  // sera rempli à l'ouverture du chat

  async function loadSystemPrompt() {
    if (SYSTEM_INSTRUCTION) return;
    try {
      const res = await fetch(PROMPT_ENDPOINT);
      const j = await res.json();
      if (j.prompt) {
        SYSTEM_INSTRUCTION = j.prompt;
        console.log("[ARGO] System prompt loaded (" + j.prompt.length + " chars)");
      } else {
        console.error("[ARGO] No prompt in response:", j);
      }
    } catch (e) {
      console.error("[ARGO] Failed to load system prompt:", e);
    }
  }

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
      #aa-widget-btn .aa-mascot {
        width: 44px !important;
        height: 44px !important;
        object-fit: contain !important;
        flex-shrink: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        animation: aa-mascot-float 2.5s ease-in-out infinite;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.2));
      }
      @keyframes aa-mascot-float {
        0%,100% { transform: translateY(0) rotate(-3deg); }
        50%     { transform: translateY(-3px) rotate(3deg); }
      }
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
      .aa-orb-wrap { position: relative !important; width: 40px !important; height: 40px !important; flex-shrink: 0 !important; margin: 0 !important; padding: 0 !important; }
      #aa-overlay .aa-avatar {
        width: 40px !important;
        height: 40px !important;
        border-radius: 50% !important;
        object-fit: cover !important;
        border: 2px solid #334155 !important;
        transition: all 0.4s ease !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        max-width: 40px !important;
        min-width: 40px !important;
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

      /* ==== Effets de mise en avant — animations sympas pour étayer le propos ==== */

      /* Highlight principal : marker pen + ripple + pop */
      .aa-highlight-glow {
        position: relative !important;
        z-index: 9998 !important;
        border-radius: 10px !important;
        animation:
          aa-marker-bg 4.5s ease-out forwards,
          aa-ripple-border 1.4s ease-out 0s 3,
          aa-scale-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      @keyframes aa-marker-bg {
        0%   { background: linear-gradient(120deg, transparent 0%, transparent 50%, transparent 100%); box-shadow: 0 0 0 0 rgba(124,58,237,0); }
        8%   { background: linear-gradient(120deg, rgba(252,211,77,0.55) 0%, rgba(252,211,77,0.55) 30%, transparent 80%); }
        25%  { background: linear-gradient(120deg, rgba(252,211,77,0.5) 0%, rgba(252,211,77,0.5) 100%); box-shadow: 0 8px 30px -8px rgba(124,58,237,0.4); }
        55%  { background: linear-gradient(120deg, rgba(167,139,250,0.35) 0%, rgba(167,139,250,0.35) 100%); }
        100% { background: transparent; box-shadow: 0 0 0 0 rgba(124,58,237,0); }
      }
      @keyframes aa-ripple-border {
        0%   { outline: 3px solid rgba(124,58,237,0.95); outline-offset: 2px; }
        50%  { outline: 3px solid rgba(124,58,237,0); outline-offset: 16px; }
        100% { outline: 3px solid rgba(124,58,237,0); outline-offset: 2px; }
      }
      @keyframes aa-scale-pop {
        0%   { transform: scale(0.96); }
        60%  { transform: scale(1.02); }
        100% { transform: scale(1); }
      }

      /* Badge flottant "👇 ici" qui pointe vers l'élément */
      .aa-pointer-badge {
        position: absolute;
        top: -18px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #fcd34d, #f59e0b);
        color: #1e1b4b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        font-weight: 800;
        padding: 4px 12px;
        border-radius: 999px;
        box-shadow: 0 4px 12px rgba(245,158,11,0.45);
        z-index: 9999;
        pointer-events: none;
        white-space: nowrap;
        letter-spacing: 0.5px;
        animation: aa-badge-bounce 1.2s ease-in-out infinite, aa-badge-fade 4.5s ease-out forwards;
      }
      .aa-pointer-badge::after {
        content: "";
        position: absolute;
        bottom: -5px; left: 50%;
        transform: translateX(-50%) rotate(45deg);
        width: 8px; height: 8px;
        background: #f59e0b;
      }
      @keyframes aa-badge-bounce {
        0%,100% { transform: translateX(-50%) translateY(0); }
        50%     { transform: translateX(-50%) translateY(-4px); }
      }
      @keyframes aa-badge-fade {
        0%,85% { opacity: 1; }
        100%   { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(0.9); }
      }

      /* CTA Pulse — plus dramatique avec double ring + gradient aura */
      .aa-cta-pulse {
        position: relative !important;
        z-index: 9998 !important;
        animation:
          aa-cta-bounce 0.7s ease-in-out infinite alternate,
          aa-cta-ring 1.4s ease-out infinite !important;
      }
      @keyframes aa-cta-bounce {
        0%   { transform: translateY(0) scale(1); }
        100% { transform: translateY(-3px) scale(1.04); }
      }
      @keyframes aa-cta-ring {
        0%   { box-shadow: 0 0 0 0 rgba(124,58,237,0.75), 0 0 0 0 rgba(6,182,212,0.55); }
        50%  { box-shadow: 0 0 0 14px rgba(124,58,237,0), 0 0 0 26px rgba(6,182,212,0); }
        100% { box-shadow: 0 0 0 0 rgba(124,58,237,0), 0 0 0 0 rgba(6,182,212,0); }
      }

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
        background: rgba(124,58,237,0.1); border: 1px solid #7c3aed; border-radius: 50%; width: 36px; height: 36px;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; transition: all 0.2s; color: #a78bfa; padding: 0;
      }
      .aa-call-btn svg { width: 16px; height: 16px; stroke: currentColor; fill: none; }
      .aa-call-btn:hover { background: rgba(124,58,237,0.2); border-color: #a78bfa; color: #c4b5fd; transform: scale(1.05); }
      .aa-call-btn.active { background: #7c3aed; border-color: #7c3aed; color: #fff; }
      .aa-hangup-btn {
        background: #ef4444; color: #fff; border: none; border-radius: 50px;
        padding: 8px 18px; font-size: 0.85rem; font-weight: 600; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;
      }
      .aa-hangup-btn:hover { background: #dc2626; box-shadow: 0 2px 12px rgba(239,68,68,0.4); }
      .aa-voice-hint { font-size: 0.75rem; color: #64748b; }

      @media (max-width: 600px) {
        #aa-widget-btn {
          bottom: 20px;
          right: 16px;
          padding: 8px;
          font-size: 0.9rem;
          border-radius: 50%;
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #7c3aed, #06b6d4);
        }
        #aa-widget-btn .aa-btn-text { display: none !important; }
        #aa-widget-btn .aa-mascot { width: 52px !important; height: 52px !important; }
        #aa-widget-btn .aa-badge { top: -6px; right: -6px; font-size: 0.55rem; padding: 2px 6px; }
        #aa-overlay { right: 10px; left: 10px; width: auto; bottom: 95px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ============ INJECT HTML ============
  function injectHTML() {
    const btn = document.createElement("button");
    btn.id = "aa-widget-btn";
    btn.innerHTML = `<img class="aa-mascot" src="${BACKEND_URL}/argo-mascot.gif" alt="Assistant Argo" /><span class="aa-btn-text">Une question sur la Monnaie de l'IA&nbsp;?<br><strong>Discutez avec notre assistant</strong></span><span class="aa-badge">GRATUIT</span>`;
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
        <button class="aa-call-btn" id="aa-call" title="Passer en mode vocal" aria-label="Appel"><svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></button>
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

  // ============ PAGE ANALYZER — l'agent comprend la page où il opère ============
  let PAGE_BRIEF = null; // Brief structuré de la page (généré par IA)

  function extractPageContent() {
    // Récupère le contenu textuel utile de la page (sans nav, ads, scripts)
    const exclude = "script, style, nav, header[role=banner], footer, .ad, [class*=advert], [id*=advert], [class*=cookie], [class*=banner-cookie], iframe, .aa-overlay, #aa-overlay, #aa-widget-btn";
    const root = document.body.cloneNode(true);
    root.querySelectorAll(exclude).forEach(el => el.remove());

    const title = document.title || "";
    const url = window.location.href;

    // Texte structuré : titres + premiers paragraphes
    const lines = [];
    const headings = root.querySelectorAll("h1, h2, h3");
    headings.forEach(h => {
      const t = (h.textContent || "").trim().replace(/\s+/g, " ");
      if (t && t.length < 300) {
        const level = h.tagName === "H1" ? "#" : h.tagName === "H2" ? "##" : "###";
        lines.push(`${level} ${t}`);
      }
    });

    // Paragraphes les plus longs (= les plus informatifs)
    const paras = Array.from(root.querySelectorAll("p"))
      .map(p => (p.textContent || "").trim().replace(/\s+/g, " "))
      .filter(t => t.length > 80 && t.length < 800)
      .slice(0, 30);

    // Prix / boutons / mentions monétaires
    const allText = root.textContent.replace(/\s+/g, " ");
    const prices = Array.from(allText.matchAll(/[\d\s]{1,5}\s*(?:€|euros?|EUR|\$|USD)\b/gi))
      .map(m => m[0].trim())
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 10);

    const ctas = Array.from(document.querySelectorAll("a, button"))
      .map(b => (b.textContent || "").trim().replace(/\s+/g, " "))
      .filter(t => t.length > 4 && t.length < 80)
      .filter(t => /commander|rejoindre|inscri|accéder|achat|s'abonner|je veux|sécuris/i.test(t))
      .slice(0, 8);

    return {
      title,
      url,
      headings: lines.slice(0, 40).join("\n"),
      paragraphs: paras.join("\n\n").slice(0, 8000),
      prices,
      ctas,
    };
  }

  async function generatePageBrief() {
    // Cache : si on a déjà analysé cette page (par hash du titre+url), réutiliser
    const cacheKey = "aa-brief-" + (window.location.pathname || "/");
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        PAGE_BRIEF = JSON.parse(cached);
        console.log("[ARGO] Page brief loaded from cache:", PAGE_BRIEF.product_name);
        return;
      }
    } catch {}

    if (!state.apiKey) {
      console.warn("[ARGO] Cannot analyze page: no apiKey yet");
      return;
    }

    console.log("[ARGO] 🔍 Analyzing host page with AI...");
    const content = extractPageContent();
    const prompt = `Tu analyses une page de vente. Voici son contenu :

TITRE PAGE : ${content.title}
URL : ${content.url}

STRUCTURE (titres) :
${content.headings}

EXTRAITS DU CONTENU :
${content.paragraphs}

PRIX DÉTECTÉS : ${content.prices.join(", ") || "aucun"}
CTAs : ${content.ctas.join(" / ") || "aucun"}

Génère un brief JSON STRICT avec ces clés (et seulement celles-ci) :
{
  "product_name": "nom du produit/service vendu (court)",
  "publisher": "éditeur/société qui vend",
  "expert": "nom de l'expert/auteur mis en avant",
  "main_promise": "promesse principale en 1 phrase",
  "price": "prix principal affiché",
  "guarantee": "garantie si mentionnée (durée, conditions)",
  "key_arguments": ["3 à 5 arguments clés"],
  "target_audience": "profil du visiteur cible",
  "topic": "thème global (crypto, nucléaire, IA, etc.)",
  "is_match_for_argo": false,
  "is_match_reason": "explique pourquoi cette page colle ou pas avec le produit 'Swiss Crypto Club' d'Argo Éditions (lettre Monnaie de l'IA)"
}

Réponse en JSON pur, sans markdown.`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 800, temperature: 0.2, responseMimeType: "application/json" },
          }),
        }
      );
      const data = await res.json();
      const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      PAGE_BRIEF = JSON.parse(txt);
      sessionStorage.setItem(cacheKey, txt);
      console.log("[ARGO] ✅ Page brief generated:", PAGE_BRIEF);
    } catch (e) {
      console.warn("[ARGO] Page brief generation failed:", e);
      PAGE_BRIEF = null;
    }
  }

  function buildPageContextForPrompt() {
    if (!PAGE_BRIEF) return "";
    const b = PAGE_BRIEF;
    return `

═══════════════════════════════════════════════════════════
CONTEXTE DE LA PAGE OÙ TU OPÈRES (analyse automatique)
═══════════════════════════════════════════════════════════

Tu es affiché en tant qu'assistant sur cette page de vente :
- **Produit vendu sur la page** : ${b.product_name || "?"}
- **Éditeur** : ${b.publisher || "?"}
- **Expert mis en avant** : ${b.expert || "?"}
- **Promesse principale** : ${b.main_promise || "?"}
- **Prix affiché** : ${b.price || "?"}
- **Garantie** : ${b.guarantee || "?"}
- **Thème** : ${b.topic || "?"}
- **Arguments clés** : ${(b.key_arguments || []).join(" / ")}

**Match avec le Swiss Crypto Club (Argo Éditions / Monnaie de l'IA)** : ${b.is_match_for_argo ? "OUI" : "NON"}
${b.is_match_reason ? "Raison : " + b.is_match_reason : ""}

═══════════════════════════════════════════════════════════
RÈGLE DE COHÉRENCE PAGE
═══════════════════════════════════════════════════════════

Si la page parle d'un AUTRE produit que le Swiss Crypto Club (Monnaie de l'IA) :
- N'essaye PAS de vendre le Swiss Crypto Club de force
- Reconnais que le visiteur est sur "${b.product_name || "cette page"}"
- Réponds AUX QUESTIONS DU VISITEUR sur le contenu de la page qu'il a sous les yeux
- Sois honnête : "Je suis l'Assistant Argo, dédié à la Monnaie de l'IA. Vous êtes sur la page ${b.product_name || "actuelle"}. Si vous avez des questions sur ce contenu, je peux vous aider avec ce que je vois sur la page."
- Tu peux utiliser les arguments et le prix RÉELS de la page (vus dans ce brief)
- Ne mentionne pas Damien/Martin ni le Swiss Crypto Club si la page n'en parle pas

Si la page parle bien de la Monnaie de l'IA / Swiss Crypto Club :
- Comporte-toi normalement comme dans le reste de ce prompt`;
  }

  // ============ PAGE CONTROL — l'agent peut piloter la page hôte ============
  let PAGE_SECTIONS = []; // [{name, keywords, el}, ...]

  function _isVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null && el.tagName !== "BODY") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function _shorten(txt, maxLen) {
    txt = (txt || "").trim().replace(/\s+/g, " ");
    if (txt.length <= maxLen) return txt;
    return txt.slice(0, maxLen - 1) + "…";
  }

  // Détecte si un paragraphe contient une info importante (chiffres, %, €, $, highlights, bold)
  function _isImportantParagraph(p) {
    const txt = (p.textContent || "").trim();
    if (txt.length < 30 || txt.length > 600) return false;
    // Contient un montant ou un pourcentage marquant
    if (/[\d\s]{1,8}\s*(?:€|euros?|\$|USD|EUR)\b/i.test(txt)) return true;
    if (/\+\s*\d{2,5}\s*%/.test(txt)) return true;             // +1500%, +9300%
    if (/x\s*\d{2,4}\b/i.test(txt)) return true;               // X10, X16, X201
    if (/\d{1,4}[''\s]?\d{3}/.test(txt)) return true;          // 1000, 1'500, 9 072
    // Contient du surlignage jaune
    if (p.querySelector('[style*="background-color: #ffff00"], [style*="background-color:#ffff00"]')) return true;
    // Citation marquante
    if (/^["«""]/.test(txt) || /["»""]\s*\.?\s*$/.test(txt)) return true;
    return false;
  }

  function scanPageSections() {
    PAGE_SECTIONS = [];
    let counter = 1;
    const seenTexts = new Set();

    function _push(prefix, el, displayText) {
      if (!_isVisible(el)) return;
      const key = (displayText || "").trim().toLowerCase().slice(0, 80);
      if (!key || seenTexts.has(key)) return;
      seenTexts.add(key);
      PAGE_SECTIONS.push({
        id: prefix + "_" + counter++,
        name: displayText,
        el,
        kind: prefix,
      });
    }

    // 1) TITRES : h1, h2, h3, h4 (les ancres principales)
    document.querySelectorAll("h1, h2, h3, h4").forEach((h) => {
      const txt = _shorten(h.textContent, 150);
      if (txt && txt.length > 3) _push("sec", h, txt);
    });

    // 2) PASSAGES CLÉS : paragraphes contenant chiffres, %, €, $, ou highlights
    document.querySelectorAll("p").forEach((p) => {
      if (!_isImportantParagraph(p)) return;
      const txt = _shorten(p.textContent, 140);
      if (txt) _push("para", p, txt);
    });

    // 3) ÉLÉMENTS SURLIGNÉS (jaune) — souvent les phrases-punch
    document.querySelectorAll('[style*="background-color: #ffff00"], [style*="background-color:#ffff00"]').forEach((el) => {
      // Remonter au parent visible si l'élément lui-même est inline
      let target = el;
      let cur = el;
      while (cur && cur.parentElement && cur.tagName !== "P" && cur.tagName !== "DIV" && cur.tagName !== "LI") {
        cur = cur.parentElement;
      }
      if (cur && cur.tagName === "P") target = cur;
      const txt = _shorten(el.textContent, 140);
      if (txt && txt.length > 15) _push("highlight", target, "★ " + txt);
    });

    // 4) IMAGES IMPORTANTES — toutes les images de contenu (pas les icônes)
    document.querySelectorAll("img").forEach((img) => {
      const src = (img.src || "").toLowerCase();
      const alt = (img.alt || "").trim();
      // Filtre : skip très petites images (icônes/logos répétitifs) et le widget lui-même
      if (src.includes("argo-mascot")) return;
      if (src.includes("favicon")) return;
      const rect = img.getBoundingClientRect();
      const widthHint = rect.width || img.naturalWidth || 0;
      if (widthHint > 0 && widthHint < 80) return;  // Skip icônes < 80px

      // Inférer un label descriptif à partir du nom de fichier (très expressif)
      const filename = src.split("/").pop()
        .replace(/[-_]/g, " ")
        .replace(/\.(png|jpg|jpeg|gif|webp|svg)$/i, "")
        .trim();
      let descriptor = alt || filename || "Image";

      // Enrichir avec un préfixe sémantique selon le type
      let prefix = "🖼 Visuel";
      const hasDamien = /damien/i.test(filename) || /damien/i.test(alt);
      const hasMartin = /martin/i.test(filename) || /martin/i.test(alt);
      const hasIanKing = /ian.?king/i.test(filename) || /ian.?king/i.test(alt);
      const hasMarcSchneider = /marc.?schneider/i.test(filename) || /marc.?schneider/i.test(alt);
      const isPerfChart = /perf|graph|chart|cours/i.test(filename);
      const isConference = /conference|portrait/i.test(filename);

      // 1) Vraies PHOTOS de personnes (jamais "perf-...") — PRIORITÉ HAUTE
      if (isConference && hasDamien && hasMartin) prefix = "👥 Photo de Damien et Martin (en conférence)";
      else if (isConference && hasDamien) prefix = "👤 Photo de Damien";
      else if (isConference && hasMartin) prefix = "👤 Photo de Martin";
      else if (!isPerfChart && hasDamien && hasMartin) prefix = "👥 Photo de Damien et Martin";
      else if (!isPerfChart && hasDamien) prefix = "👤 Photo de Damien";
      else if (!isPerfChart && hasMartin) prefix = "👤 Photo de Martin";
      else if (!isPerfChart && hasIanKing) prefix = "👤 Photo de Ian King";
      else if (!isPerfChart && hasMarcSchneider) prefix = "👤 Photo de Marc Schneider";
      // 2) GRAPHIQUES de performance (pas des photos)
      else if (isPerfChart && hasDamien) prefix = "📈 Graphique de performance de Damien";
      else if (isPerfChart && hasMartin) prefix = "📈 Graphique de performance de Martin";
      else if (isPerfChart) prefix = "📈 Graphique de performance";
      // 3) Autres catégories
      else if (/tablette|pad|cover|dossier/i.test(filename)) prefix = "📔 Couverture du dossier";
      else if (/tweet|twitter|x-post/i.test(filename)) prefix = "🐦 Tweet";
      else if (/garantie/i.test(filename)) prefix = "🛡 Garantie";
      else if (/prix/i.test(filename)) prefix = "💰 Visuel prix";
      else if (/youtube|video/i.test(filename)) prefix = "🎥 Photo / Vidéo";
      else if (/recap/i.test(filename)) prefix = "🎁 Récap offre";
      else if (/club|logo/i.test(filename)) prefix = "🏷 Logo / Visuel club";
      else if (/cern/i.test(filename)) prefix = "🏛 Photo / Lieu (CERN)";

      // Préfixe + descriptif
      _push("img", img, `${prefix} (${_shorten(descriptor, 60)})`);
    });

    // 5) CTAs : boutons et liens d'achat
    document.querySelectorAll("a, button").forEach((b) => {
      const txt = (b.textContent || "").trim().replace(/\s+/g, " ");
      const href = (b.href || "").toLowerCase();
      if (!txt || txt.length < 4 || txt.length > 120) return;
      const isCTA = /rejoindre|inscri|accéder|commander|abonne|sécuris|achat|je veux|partie du club|garantie|club|offre/i.test(txt) ||
                    /checkout|offre|order-form|abonnement|bdc/i.test(href);
      if (!isCTA) return;
      _push("cta", b, "🔘 " + _shorten(txt, 100));
    });

    console.log("[ARGO] Page scan: %d éléments (titres + passages clés + highlights + images + boutons)", PAGE_SECTIONS.length);
  }

  function findSectionById(id) {
    return PAGE_SECTIONS.find(s => s.id === id);
  }

  function scrollToTarget(el, highlight = true, badgeText = "👇 ICI") {
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (highlight) {
      // Sauvegarder le position style original pour pouvoir attacher le badge
      const computed = window.getComputedStyle(el);
      const needsRel = computed.position === "static";
      const prevPosition = el.style.position;
      if (needsRel) el.style.position = "relative";

      el.classList.add("aa-highlight-glow");

      // Ajouter un badge flottant "👇 ICI" qui pointe vers l'élément
      const badge = document.createElement("div");
      badge.className = "aa-pointer-badge";
      badge.textContent = badgeText;
      el.appendChild(badge);

      setTimeout(() => {
        el.classList.remove("aa-highlight-glow");
        if (badge.parentNode === el) el.removeChild(badge);
        if (needsRel) el.style.position = prevPosition;
      }, 4500);
    }
    return true;
  }

  function pulseCTA() {
    const cta = PAGE_SECTIONS.find(s => s.kind === "cta");
    if (cta) {
      scrollToTarget(cta.el);
      cta.el.classList.add("aa-cta-pulse");
      setTimeout(() => cta.el.classList.remove("aa-cta-pulse"), 6000);
      return true;
    }
    return false;
  }

  // Définition des tools envoyés à Gemini
  function getToolsForGemini() {
    return [{
      functionDeclarations: [
        {
          name: "scroll_vers_section",
          description: "Scroll la page du visiteur vers une section EXACTE par son ID, et la met en surbrillance violette pendant 3 secondes. Utilise cet outil quand tu mentionnes une partie spécifique de la page pour guider visuellement le prospect. Tu DOIS utiliser un section_id qui existe dans la liste 'SECTIONS DISPONIBLES' fournie dans le contexte. N'invente JAMAIS un ID.",
          parameters: {
            type: "object",
            properties: {
              section_id: {
                type: "string",
                description: "ID exact d'une section de la liste fournie (ex: 'sec_3' ou 'cta_12'). Doit correspondre EXACTEMENT à un ID de la liste 'SECTIONS DISPONIBLES'."
              }
            },
            required: ["section_id"]
          }
        },
        {
          name: "montrer_bouton_inscription",
          description: "Scroll vers le premier bouton d'inscription/achat et le fait pulser en violet pendant 6 secondes pour attirer l'attention. À utiliser UNIQUEMENT quand le prospect est CHAUD ou dit qu'il veut acheter.",
          parameters: { type: "object", properties: {} }
        }
      ]
    }];
  }

  function executeToolCall(name, args) {
    console.log("[ARGO] 🎯 Tool call:", name, args);
    if (name === "scroll_vers_section") {
      const sec = findSectionById(args.section_id);
      if (sec) {
        scrollToTarget(sec.el);
        return { success: true, scrolled_to: sec.name };
      }
      console.warn("[ARGO] Section ID not found:", args.section_id);
      return {
        success: false,
        error: "ID '" + args.section_id + "' inexistant",
        valid_ids: PAGE_SECTIONS.map(s => s.id).slice(0, 20),
      };
    }
    if (name === "montrer_bouton_inscription") {
      const ok = pulseCTA();
      return { success: ok, message: ok ? "Bouton mis en avant" : "Pas de bouton trouvé" };
    }
    return { success: false, error: "Tool inconnu: " + name };
  }

  // ============ TEXT MODE (Gemini REST API + Tool Calls) ============
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

    // Construire le system prompt avec : brief IA de la page + table des matières complète
    const sectionsList = PAGE_SECTIONS
      .map(s => `  ${s.id} → "${s.name}"`)
      .join("\n");
    const dynamicPrompt = SYSTEM_INSTRUCTION +
      buildPageContextForPrompt() +
      "\n\n═══════════════════════════════════════════════════════════\n" +
      "🖼 TU PILOTES L'ÉCRAN DU VISITEUR (CAPACITÉ TRÈS PUISSANTE)\n" +
      "═══════════════════════════════════════════════════════════\n\n" +
      "Tu as la capacité de scroller la page du visiteur et de surligner visuellement la section pertinente. " +
      "Comme un vrai conseiller qui pointe du doigt. ANNONCE-LE pour que le visiteur regarde son écran.\n\n" +
      "Phrases d'annonce naturelles :\n" +
      "- 'Comme je peux vous le montrer à l'écran...'\n" +
      "- 'Regardez juste là, vous voyez ?'\n" +
      "- 'Si vous voulez, je vous montre où ça se situe sur la page'\n" +
      "- 'Tenez, regardez ce passage 👇'\n" +
      "- 'Là, sous vos yeux...'\n\n" +
      "PROCÉDURE : annonce verbale → tu appelles scroll_vers_section avec l'ID EXACT → le visiteur voit le scroll + surbrillance violette + badge '👇 ICI'.\n\n" +
      "═══════════════════════════════════════════════════════════\n" +
      "TABLE DES MATIÈRES COMPLÈTE DE LA PAGE\n" +
      "═══════════════════════════════════════════════════════════\n\n" +
      "PRÉFIXES :\n" +
      "  sec_X       = titre de section\n" +
      "  para_X      = paragraphe avec chiffre / % / €\n" +
      "  highlight_X = passage surligné en jaune (★ phrase punch)\n" +
      "  img_X       = image clé\n" +
      "  cta_X       = bouton d'inscription/achat\n\n" +
      "LISTE (IDs à utiliser tels quels) :\n" +
      (sectionsList || "(aucun élément détecté)") +
      "\n\nRÈGLES STRICTES :\n" +
      "1. ID EXACT de la liste ci-dessus, jamais inventé.\n" +
      "2. 🖼 RÈGLE DU VISUEL (importante) : si le visiteur dit 'voir', 'montre-moi', 'image', 'visuel', 'à quoi ressemble', 'dossier', 'couverture', 'photo', 'tablette' → tu PRIVILÉGIES IMPÉRATIVEMENT un `img_X`, JAMAIS un sec_X / para_X.\n" +
      "3. 👤 RÈGLE DE L'EXPERT : si le visiteur prononce un PRÉNOM (Damien, Martin) ou demande à voir un expert :\n" +
      "    a) Cherche d'abord un `img_X` 👤 Photo de [Nom]\n" +
      "    b) Si absent, prends `img_X` 👥 Photo de Damien et Martin (photo conjointe)\n" +
      "    c) NE PRENDS JAMAIS un `img_X` 📈 Graphique de performance — c'est un graphique, pas une photo de la personne. Sauf si le visiteur demande explicitement la performance/le gain de cette personne.\n" +
      "    d) Si vraiment aucune photo n'existe : reste sur `para_X` qui parle de la personne.\n" +
      "4. 💰 RÈGLE DU CHIFFRE : montant / pourcentage précis → `para_X` ou `highlight_X` contenant le chiffre.\n" +
      "5. 🔘 RÈGLE DU BOUTON : inscription / achat → `cta_X`.\n" +
      "6. Si aucun ID ne colle, ne scroll pas, réponds juste en texte.\n" +
      "7. Maximum 1 appel par réponse.\n\n" +
      "EXEMPLES :\n" +
      "- 'C'est combien ?' → 'Le prix anniversaire est à 997 € par an, regardez là 👇' + scroll sur cta_X / para_X du prix\n" +
      "- 'Montre-moi les dossiers offerts' → scroll sur un `img_X` 📔 Couverture du dossier\n" +
      "- 'Qui est Damien ?' → 'Damien est l'expert qui a fait +20 000 % sur Ethereum, je vous le montre' + scroll sur `img_X` 👤 Photo de Damien\n" +
      "- 'Damien et Martin ils ressemblent à quoi ?' → scroll sur `img_X` 👥 Photo de Damien et Martin\n" +
      "- 'C'est qui les experts ?' → scroll sur la photo des deux experts (`img_X` 👥)\n" +
      "- 'À quoi ressemble la tablette ?' → scroll sur l'`img_X` 📔 correspondant\n" +
      "- 'Comment marche la garantie ?' → scroll sur `sec_X` GARANTIE ou `img_X` 🛡 Garantie si visuel disponible";

    try {
      // Boucle pour gérer les tool calls (max 3 tours)
      let response = null;
      for (let i = 0; i < 3; i++) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${state.apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: dynamicPrompt }] },
              contents: state.conversationHistory,
              tools: getToolsForGemini(),
              generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.85,
                thinkingConfig: { thinkingBudget: 0 },  // Désactive le "thinking" pour réponses directes
              },
            }),
          }
        );
        const data = await res.json();
        if (!data.candidates || !data.candidates[0]) break;
        const parts = data.candidates[0].content.parts || [];
        const functionCalls = parts.filter(p => p.functionCall);
        const textParts = parts.filter(p => p.text);

        // Push la réponse de l'assistant dans l'historique
        state.conversationHistory.push({ role: "model", parts: parts });

        // Si des tool calls, on les exécute et on relance
        if (functionCalls.length > 0) {
          const toolResults = functionCalls.map(fc => ({
            functionResponse: {
              name: fc.functionCall.name,
              response: executeToolCall(fc.functionCall.name, fc.functionCall.args || {}),
            }
          }));
          state.conversationHistory.push({ role: "user", parts: toolResults });
          // Si il y a aussi du texte, on l'affiche déjà
          if (textParts.length > 0) {
            response = textParts.map(p => p.text).join("");
            break;
          }
          // Sinon on continue la boucle pour avoir le texte de l'agent
          continue;
        }
        if (textParts.length > 0) {
          response = textParts.map(p => p.text).join("");
          break;
        }
        break;
      }

      hideTyping();
      if (response) {
        state.conversationLog.push({ role: "assistant", text: response });
        addMessage("bot", response);
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
    console.log("[ARGO] connectVoice() called. apiKey present:", !!state.apiKey, "len:", state.apiKey?.length);
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${state.apiKey}`;
    console.log("[ARGO] Opening WebSocket...");
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("[ARGO] ✅ WebSocket OPEN. Sending setup. Model:", LIVE_MODEL);
      // Prompt vocal enrichi : table des matières + capacité visuelle annoncée
      const sectionsList = PAGE_SECTIONS
        .map(s => `  ${s.id} → "${s.name}"`)
        .join("\n");
      const fullPrompt = SYSTEM_INSTRUCTION +
        buildPageContextForPrompt() +
        "\n\n═══════════════════════════════════════════════════════════\n" +
        "🖼 TU PILOTES L'ÉCRAN DU VISITEUR (CAPACITÉ TRÈS PUISSANTE)\n" +
        "═══════════════════════════════════════════════════════════\n\n" +
        "Tu as la capacité unique de scroller la page du visiteur et de surligner visuellement la section pertinente. " +
        "Comme un vrai conseiller qui pointe du doigt. Utilise cet outil systématiquement quand tu parles d'une partie précise de la page.\n\n" +
        "ANNONCE-LE EXPLICITEMENT pour que le visiteur regarde son écran. Phrases types :\n" +
        "- 'Comme je vous le montre à l'écran...'\n" +
        "- 'Regardez juste là, vous voyez ?'\n" +
        "- 'Tenez, je vous le pointe sur la page'\n" +
        "- 'Si vous regardez votre écran, vous verrez...'\n" +
        "- 'Là, juste sous vos yeux...'\n\n" +
        "PROCÉDURE :\n" +
        "1. Annonce verbale ('Regardez juste là, le prix anniversaire...')\n" +
        "2. Tu appelles scroll_vers_section avec l'ID EXACT (ex: 'cta_28')\n" +
        "3. Le visiteur voit la page scroller + surbrillance violette + badge '👇 ICI'\n\n" +
        "TABLE DES MATIÈRES DE LA PAGE (IDs précis à utiliser) :\n" +
        (sectionsList || "(aucun)") +
        "\n\nRÈGLES DE CHOIX D'ID :\n" +
        "🖼 'voir', 'montre-moi', 'image', 'dossier', 'couverture', 'tablette' → IMPÉRATIVEMENT `img_X` (et pas sec_X / para_X)\n" +
        "👤 Prénom prononcé (Damien, Martin) ou 'qui est l'expert' → cherche `img_X` 👤 Photo de [Nom], sinon `img_X` 👥 Photo conjointe. JAMAIS un 📈 Graphique sauf si on demande explicitement les performances de cette personne.\n" +
        "💰 Demande de chiffre / prix / pourcentage → `para_X` ou `highlight_X`\n" +
        "🔘 Demande d'inscription / achat → `cta_X`\n\n" +
        "N'invente JAMAIS un ID. Si rien ne correspond, ne scroll pas, contente-toi du texte.";

      const setupMsg = {
        setup: {
          model: `models/${LIVE_MODEL}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
              languageCode: "fr-FR",
            },
          },
          systemInstruction: { parts: [{ text: fullPrompt }] },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: getToolsForGemini(),
          // VAD configuré pour éviter les coupures intempestives :
          // sensibilité LOW au début de parole + 500ms de silence requis avant de considérer la fin
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: "START_SENSITIVITY_LOW",
              endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
              prefixPaddingMs: 200,
              silenceDurationMs: 700,
            },
          },
        },
      };
      console.log("[ARGO] Setup payload size:", JSON.stringify(setupMsg).length, "chars, tools:", getToolsForGemini()[0].functionDeclarations.length);
      ws.send(JSON.stringify(setupMsg));
    };

    ws.onmessage = async (event) => {
      let data;
      if (event.data instanceof Blob) {
        try { data = JSON.parse(await event.data.text()); } catch (e) { console.error("[ARGO] Blob parse error:", e); return; }
      } else {
        try { data = JSON.parse(event.data); } catch (e) { console.error("[ARGO] JSON parse error:", e); return; }
      }
      console.log("[ARGO] 📨 WS message received. Keys:", Object.keys(data));

      if (data.setupComplete) {
        console.log("[ARGO] ✅ setupComplete received! Starting mic...");
        state.isConnected = true;
        $orb.className = "aa-avatar speaking";
        $status.textContent = "L'assistant parle...";
        ws.send(JSON.stringify({ realtimeInput: { text: "Présente-toi avec ta phrase d'accroche obligatoire." } }));
        startMic().catch(e => console.error("[ARGO] startMic error:", e));
        startCallTimers(ws);
        return;
      }

      if (data.error) {
        console.error("[ARGO] ❌ Gemini error:", JSON.stringify(data.error));
        $status.textContent = "Erreur: " + (data.error.message || "Gemini");
      }

      // 🎯 TOOL CALLS pendant l'appel vocal — réponse IMMÉDIATE (model 3.1 sync)
      if (data.toolCall && data.toolCall.functionCalls) {
        console.log("[ARGO] 🎙️🎯 Tool call(s):", JSON.stringify(data.toolCall.functionCalls));
        const functionResponses = data.toolCall.functionCalls.map(fc => {
          if (!fc.id) console.warn("[ARGO] ⚠️ Tool call sans id, hang possible:", fc);
          const result = executeToolCall(fc.name, fc.args || {});
          // Format strict de la doc Gemini Live :
          // {id, name, response: {result: ...}} — response DOIT être un object plat
          return {
            id: fc.id,
            name: fc.name,
            response: { result: result.success ? (result.scrolled_to || "ok") : (result.error || "fail") },
          };
        });
        const payload = { toolResponse: { functionResponses } };
        console.log("[ARGO] 📤 toolResponse:", JSON.stringify(payload));
        ws.send(JSON.stringify(payload));
      }
      if (data.toolCallCancellation) {
        console.log("[ARGO] 🚫 toolCallCancellation:", data.toolCallCancellation);
      }

      const sc = data.serverContent;
      if (!sc) return;

      if (sc.interrupted) {
        console.warn("[ARGO] 🛑 INTERRUPTED par Gemini (VAD a détecté un son côté micro)");
        state.audioPlayer.interrupt();
        $orb.className = "aa-avatar listening";
        $status.textContent = "L'assistant vous écoute...";
      }
      if (sc.turnComplete) {
        console.log("[ARGO] ✅ turnComplete (fin de tour de l'agent)");
      }
      if (sc.generationComplete) {
        console.log("[ARGO] 🎬 generationComplete (l'agent a fini de générer)");
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

    ws.onerror = (err) => { console.error("[ARGO] ❌ WS error event:", err); $status.textContent = "Erreur WebSocket"; };
    ws.onclose = (ev) => {
      console.warn("[ARGO] 🔌 WS CLOSED. code:", ev.code, "reason:", ev.reason, "wasClean:", ev.wasClean);
      if (ev.code !== 1000) {
        $status.textContent = `WS fermé (${ev.code}): ${ev.reason || 'sans raison'}`;
      }
      if (state.isConnected) endVoice();
    };

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
    console.log("[ARGO] 📞 startVoice() called");
    // S'assurer que le prompt est chargé (au cas où l'appel précède l'ouverture du chat)
    await loadSystemPrompt();
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

    // S'assurer que les sections sont scannées (utiles pour les tool calls vocaux)
    if (PAGE_SECTIONS.length === 0) {
      console.log("[ARGO] Scanning page sections for voice tools...");
      scanPageSections();
    }

    // Fetch a FRESH token — the previous one was consumed by text mode
    console.log("[ARGO] Fetching fresh token from", TOKEN_ENDPOINT);
    try {
      const res = await fetch(TOKEN_ENDPOINT, { method: "POST" });
      const json = await res.json();
      console.log("[ARGO] Token response status:", res.status, "has token:", !!json.token);
      if (json.error || !json.token) throw new Error(json.error || "Pas de token");
      state.apiKey = json.token;
    } catch (err) {
      console.error("[ARGO] ❌ Token fetch error:", err);
      $status.textContent = "Erreur token: " + err.message;
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

    // Scan la page hôte pour permettre à l'agent de naviguer
    scanPageSections();

    // Charger le master prompt depuis le backend (caché du JS frontend)
    await loadSystemPrompt();

    try {
      const res = await fetch(TOKEN_ENDPOINT, { method: "POST" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      if (!json.token) throw new Error("Aucun token reçu");
      state.apiKey = json.token;

      $orb.className = "aa-avatar active";
      $status.textContent = "En ligne";

      // Génère un brief IA de la page en parallèle (ne bloque pas le greeting)
      generatePageBrief().catch(e => console.warn("[ARGO] Brief failed:", e));

      // Trigger greeting (utilise déjà le brief s'il est prêt, sinon le prochain message l'aura)
      state.conversationHistory.push({ role: "user", parts: [{ text: "[Le visiteur vient d'ouvrir le chat. Présente-toi avec ta phrase d'ouverture obligatoire.]" }] });
      showTyping();

      const greetRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${state.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION + buildPageContextForPrompt() }] },
            contents: state.conversationHistory,
            generationConfig: {
              maxOutputTokens: 512,
              temperature: 0.7,
              thinkingConfig: { thinkingBudget: 0 },
            },
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
