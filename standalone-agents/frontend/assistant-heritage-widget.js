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
  // Backend standalone (proxy sécurisé) : la clé Gemini et le prompt restent
  // côté serveur. Le navigateur n'y a jamais accès.
  // L'URL backend est dérivée AUTOMATIQUEMENT du <script src> qui charge ce
  // fichier. Rien à configurer. Fallback = data-backend-url ou défaut.
  const _CUR = document.currentScript || (function () {
    const s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  function _deriveBackend() {
    try {
      if (_CUR && _CUR.dataset && _CUR.dataset.backendUrl) return _CUR.dataset.backendUrl;
      if (_CUR && _CUR.src) return new URL(_CUR.src).origin;
    } catch (e) {}
    return "https://standalone-agents-production.up.railway.app";
  }
  const BACKEND_URL = _deriveBackend().replace(/\/$/, "");
  const AGENT = "assistant-heritage";
  const LIVE_WS_URL = BACKEND_URL.replace(/^http/, "ws") + "/api/live?agent=" + AGENT;
  const VOICE = "Puck";

  // Sauvegarde des conversations sur le backend (Supabase)
  const SAVE_ENDPOINT = BACKEND_URL + "/api/save-conversation";
  const AGENT_PRODUCT_ID = "assistant-heritage";

  // ============ SYSTEM INSTRUCTION ============
  // Le prompt de base est injecté CÔTÉ SERVEUR par le proxy /api/live.
  // Le navigateur ne le voit jamais. Pas de systemInstruction envoyé côté client.

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
    warnTimer: null,
    cutTimer: null,
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
      .ah-badge-free {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #38c768;
        color: #fff;
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 0.5px;
        padding: 3px 8px;
        border-radius: 20px;
        line-height: 1;
        box-shadow: 0 2px 6px rgba(56,199,104,0.4);
        text-transform: uppercase;
        pointer-events: none;
      }
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
    btn.innerHTML = `<span style="font-size:1.3rem">📞</span> <span>Une question sur les Trinity Sphères&nbsp;?<br><strong>Parlez à notre assistant IA</strong></span><span class="ah-badge-free">GRATUIT</span>`;
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
          <span class="ah-label">Assistant Héritage</span>
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
  function connectGemini() {
    // Proxy WS : on se connecte à NOTRE serveur (clé + prompt côté serveur).
    const ws = new WebSocket(LIVE_WS_URL);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          // model + systemInstruction injectés CÔTÉ SERVEUR par le proxy /api/live
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
              languageCode: "fr-FR",
            },
          },
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
        startCallTimers(ws);
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
      product_id: AGENT_PRODUCT_ID,
    };

    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        const ok = navigator.sendBeacon(SAVE_ENDPOINT, blob);
        if (!ok) throw new Error("sendBeacon returned false");
      } else {
        fetch(SAVE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true,
        }).catch((e) => console.error("Save failed:", e));
      }
    } catch (e) {
      console.error("Save error:", e);
      try {
        fetch(SAVE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true,
        }).catch(() => {});
      } catch {}
    }
  }

  // ============ CALL TIMERS (8 min max) ============
  const WARN_MS  = 7 * 60 * 1000; // 7 minutes
  const CUT_MS   = 8 * 60 * 1000; // 8 minutes

  function startCallTimers(ws) {
    clearCallTimers();
    // At 7 min: send a system signal so the agent knows time is almost up
    state.warnTimer = setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          realtimeInput: { text: "[SIGNAL SYSTÈME] Il reste 1 minute avant la fin de l'appel. Conclus la conversation chaleureusement." }
        }));
      }
    }, WARN_MS);
    // At 8 min: auto-disconnect
    state.cutTimer = setTimeout(() => {
      if (state.isConnected) disconnect();
    }, CUT_MS);
  }

  function clearCallTimers() {
    if (state.warnTimer) { clearTimeout(state.warnTimer); state.warnTimer = null; }
    if (state.cutTimer)  { clearTimeout(state.cutTimer);  state.cutTimer = null; }
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

      // Pas de token : la clé reste côté serveur (proxy /api/live).
      state.ws = connectGemini();
    } catch (err) {
      console.error("Assistant Heritage connect error:", err);
      $status.textContent = "Erreur : " + err.message;
      setTimeout(disconnect, 3000);
    }
  }

  function disconnect() {
    clearCallTimers();
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
