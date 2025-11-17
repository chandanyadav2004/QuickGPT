// src/components/Message.jsx
import React, { useEffect, useRef, useState } from "react";
import moment from "moment";
import Markdown from "react-markdown";
import Prism from "prismjs";
import toast from "react-hot-toast";
import { assets } from "../assets/assets";

/**
 * Message component — mobile-friendly speech with debug UI
 */
const Message = ({ message }) => {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // speech
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("auto"); // can be set by debug UI
  const utteranceRef = useRef(null);
  const initDoneRef = useRef(false);

  // debug UI
  const [debugOpen, setDebugOpen] = useState(false);
  const [lastVoiceListTime, setLastVoiceListTime] = useState(0);

  useEffect(() => {
    try {
      Prism.highlightAll();
    } catch (e) {}
  }, [message.content]);

  // --- voice loading & priming ---
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const loadVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices() || [];
        if (v.length > 0) {
          const sorted = v.slice().sort((a, b) => {
            if (a.lang === b.lang) return (a.name || "").localeCompare(b.name || "");
            return (a.lang || "").localeCompare(b.lang || "");
          });
          setVoices(sorted);
          return true;
        }
      } catch (e) {
        console.warn("loadVoices error", e);
      }
      return false;
    };

    // Try immediate, then voiceschanged, then polling: robust load
    loadVoices();
    const onVoicesChanged = () => {
      loadVoices();
      setLastVoiceListTime(Date.now());
    };
    try {
      window.speechSynthesis.addEventListener?.("voiceschanged", onVoicesChanged);
    } catch (e) {
      window.speechSynthesis.onvoiceschanged = onVoicesChanged;
    }

    // Poll as fallback
    let attempts = 0;
    const poll = setInterval(() => {
      attempts += 1;
      if (loadVoices() || attempts >= 20) clearInterval(poll);
    }, 250);

    // Prime on first gesture for mobile
    const initSpeechOnGesture = () => {
      if (initDoneRef.current) return;
      initDoneRef.current = true;
      // small test utterance to prime engine (silent if voice unavailable)
      try {
        const p = new SpeechSynthesisUtterance("hello");
        // choose a safe minimal lang
        p.lang = navigator.language || "en-US";
        window.speechSynthesis.speak(p);
      } catch (e) {
        console.warn("prime speak failed", e);
      }
    };
    document.addEventListener("touchstart", initSpeechOnGesture, { passive: true, capture: true });
    document.addEventListener("click", initSpeechOnGesture, { passive: true, capture: true });

    return () => {
      try {
        document.removeEventListener("touchstart", initSpeechOnGesture, true);
        document.removeEventListener("click", initSpeechOnGesture, true);
        window.speechSynthesis.removeEventListener?.("voiceschanged", onVoicesChanged);
        window.speechSynthesis.onvoiceschanged = null;
      } catch (e) {}
      clearInterval(poll);
    };
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      } catch (e) {}
    };
  }, []);

  // --- text cleaning ---
  const removeEmojisAndControl = (str = "") => {
    // remove surrogate pairs / emojis and control chars (keeps basic punctuation and letters)
    // This is conservative: removes many uncommon symbols that might break TTS engines.
    return str
      .replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const stripMarkdown = (md = "") => {
    if (!md) return "";
    return removeEmojisAndControl(
      md
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[.*?\]\(.*?\)/g, "")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
        .replace(/(^|\n)#+\s*/g, "$1")
        .replace(/(\*|_){1,3}([^*_]+)\1{1,3}/g, "$2")
        .replace(/^\s*[-*+]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .replace(/&[#A-Za-z0-9]+;/g, " ") // remove HTML entities
        .trim()
    );
  };

  // --- language heuristics & voice selection ---
  const detectLangCodeFromText = (text = "") => {
    if (!text) return navigator.language || "en-US";
    const trimmed = text.trim();
    try {
      if (/[一-龯]/.test(trimmed) || /[\u3040-\u30ff]/.test(trimmed)) {
        if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(trimmed)) return "ja-JP";
        return "zh-CN";
      }
      if (/\p{Script=Devanagari}/u.test(trimmed)) return "hi-IN";
      if (/\p{Script=Arabic}/u.test(trimmed)) return "ar-SA";
      if (/\p{Script=Cyrillic}/u.test(trimmed)) return "ru-RU";
      if (/[가-힣]/.test(trimmed)) return "ko-KR";
    } catch (e) {
      if (/[一-龯]/.test(trimmed)) return "zh-CN";
      if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(trimmed)) return "ko-KR";
    }
    return navigator.language || "en-US";
  };

  const chooseVoiceSafely = (text) => {
    let currentVoices = [];
    try {
      currentVoices = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || voices || [];
    } catch (e) {
      currentVoices = voices || [];
    }

    // If debug UI forced a voice URI, use it
    if (selectedVoiceURI && selectedVoiceURI !== "auto") {
      const forced = currentVoices.find((v) => v.voiceURI === selectedVoiceURI || v.name === selectedVoiceURI);
      if (forced) return forced;
    }

    const targetLang = detectLangCodeFromText(text) || navigator.language || "en-US";
    let chosen = currentVoices.find((v) => v.lang && v.lang.toLowerCase() === targetLang.toLowerCase());
    if (chosen) return chosen;

    const prefix = (targetLang || "").split("-")[0].toLowerCase();
    chosen = currentVoices.find((v) => v.lang && (v.lang || "").split("-")[0].toLowerCase() === prefix);
    if (chosen) return chosen;

    chosen = currentVoices.find((v) => v.default) || currentVoices.find((v) => v.localService);
    if (chosen) return chosen;

    if (currentVoices.length > 0) return currentVoices[0];

    return null;
  };

  // --- chunk and speak safely ---
  const splitTextToChunks = (text, maxChunkLength = 180) => {
    if (!text) return [];
    const sentences = text.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    const chunks = [];
    let current = "";
    for (const s of sentences) {
      if ((current + " " + s).trim().length <= maxChunkLength) {
        current = (current + " " + s).trim();
      } else {
        if (current) chunks.push(current);
        if (s.length <= maxChunkLength) current = s;
        else {
          for (let i = 0; i < s.length; i += maxChunkLength) chunks.push(s.slice(i, i + maxChunkLength));
          current = "";
        }
      }
    }
    if (current) chunks.push(current);
    if (chunks.length === 0 && text.length > 0) {
      for (let i = 0; i < text.length; i += maxChunkLength) chunks.push(text.slice(i, i + maxChunkLength));
    }
    return chunks;
  };

  const speakChunksSequentially = (text) => {
    const plain = stripMarkdown(text || "");
    if (!plain) {
      toast.error("Nothing to speak.");
      return;
    }
    const chunks = splitTextToChunks(plain, 200);
    if (!chunks.length) {
      toast.error("Nothing to speak.");
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    const chosenVoice = chooseVoiceSafely(plain);
    console.info("Available voices:", (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || voices);
    console.info("Chosen voice:", chosenVoice ? `${chosenVoice.name} (${chosenVoice.lang})` : "none");
    toast.info(`Using voice: ${chosenVoice?.name || chosenVoice?.lang || navigator.language}`);

    let idx = 0;
    setSpeaking(true);

    const speakNext = () => {
      if (idx >= chunks.length) {
        setSpeaking(false);
        utteranceRef.current = null;
        return;
      }
      const chunk = chunks[idx++];
      const u = new SpeechSynthesisUtterance(chunk);
      try {
        if (chosenVoice) {
          u.voice = chosenVoice;
          if (chosenVoice.lang) u.lang = chosenVoice.lang;
        } else {
          u.lang = detectLangCodeFromText(chunk) || navigator.language || "en-US";
        }
      } catch (e) {
        u.lang = detectLangCodeFromText(chunk) || navigator.language || "en-US";
      }
      u.rate = 0.95;
      u.pitch = 1;
      u.volume = 1;
      u.onstart = () => {
        utteranceRef.current = u;
        console.info("Speaking chunk:", chunk.slice(0, 80));
      };
      u.onend = () => setTimeout(() => speakNext(), 80);
      u.onerror = (err) => {
        console.error("Speech chunk error", err);
        setTimeout(() => speakNext(), 120);
      };
      try {
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.error("speak() threw", e);
        setTimeout(() => speakNext(), 120);
      }
    };

    speakNext();
  };

  const speakText = (text) => {
    if (!text) return;
    if (!("speechSynthesis" in window)) {
      toast.error("Speech not supported");
      return;
    }

    const plain = stripMarkdown(text);
    if (!plain) {
      toast.error("Nothing to speak");
      return;
    }

    // small pre-speak test to ensure engine is healthy on some mobiles:
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    // If short, speak single utterance
    if (plain.length <= 200) {
      const chosenVoice = chooseVoiceSafely(plain);
      const u = new SpeechSynthesisUtterance(plain);
      try {
        if (chosenVoice) {
          u.voice = chosenVoice;
          if (chosenVoice.lang) u.lang = chosenVoice.lang;
        } else {
          u.lang = detectLangCodeFromText(plain) || navigator.language || "en-US";
        }
      } catch (e) {
        u.lang = detectLangCodeFromText(plain) || navigator.language || "en-US";
      }
      u.rate = 0.95;
      u.pitch = 1;
      u.volume = 1;
      u.onstart = () => {
        setSpeaking(true);
        utteranceRef.current = u;
        console.info("Speaking (single):", plain.slice(0, 120));
        toast.info(`Voice: ${u.voice?.name || u.lang}`);
      };
      u.onend = () => {
        setSpeaking(false);
        utteranceRef.current = null;
      };
      u.onerror = (err) => {
        console.error("speech error (single)", err);
        setSpeaking(false);
        utteranceRef.current = null;
        // fallback to chunked
        speakChunksSequentially(text);
      };
      try {
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.error("speak single threw", e);
        speakChunksSequentially(text);
      }
    } else {
      speakChunksSequentially(text);
    }
  };

  const stopSpeaking = () => {
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) {}
    finally {
      setSpeaking(false);
      utteranceRef.current = null;
    }
  };

  // --- copy/share/download/like/dislike unchanged ---
  const handleCopy = async () => {
    try {
      const textToCopy = message.isImage ? message.content : message.content;
      await navigator.clipboard.writeText(textToCopy);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error("copy failed", err);
      toast.error("Failed to copy");
    }
  };
  const handleLike = () => { setLiked(true); setDisliked(false); toast.success("Marked as helpful"); };
  const handleDislike = () => { setDisliked(true); setLiked(false); toast("Thanks for your feedback!"); };
  const openWhatsAppShare = (text) => {
    const encoded = encodeURIComponent(text);
    const mobileUrl = `whatsapp://send?text=${encoded}`;
    const webUrl = `https://wa.me/?text=${encoded}`;
    const newWindow = window.open(mobileUrl, "_blank");
    setTimeout(() => { if (!newWindow) window.open(webUrl, "_blank"); }, 300);
  };
  const handleShareWhatsApp = () => {
    let textToShare = "";
    if (message.isImage) textToShare = `${message.content}\n\n(Shared via QuickGPT)`;
    else {
      const plain = stripMarkdown(message.content);
      const maxLen = 4000;
      const truncated = plain.length > maxLen ? plain.slice(0, maxLen) + "…" : plain;
      textToShare = `${truncated}\n\n(Shared via QuickGPT)`;
    }
    openWhatsAppShare(textToShare);
  };
  const downloadImage = async () => {
    if (!message.isImage || !message.content) { toast.error("No image to download"); return; }
    try {
      setDownloading(true);
      const res = await fetch(message.content, { mode: "cors" });
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
      const blob = await res.blob();
      const urlParts = message.content.split("/").filter(Boolean);
      let filename = urlParts[urlParts.length - 1] || `image-${Date.now()}.png`;
      if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(filename)) filename = `${filename}.png`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("Download started");
    } catch (err) {
      console.error("downloadImage error", err);
      toast.error("Failed to download image");
    } finally {
      setDownloading(false);
    }
  };

  // --- Voice Debug UI helpers ---
  const listVoices = () => {
    try {
      const vs = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || voices || [];
      setVoices(vs.slice());
      console.info("VOICES:", vs.map((v) => ({ name: v.name, lang: v.lang, default: !!v.default, local: !!v.localService })));
      setLastVoiceListTime(Date.now());
      toast.success(`Found ${vs.length} voices (console logged)`);
    } catch (e) {
      console.error("listVoices error", e);
      toast.error("Could not list voices");
    }
  };

  const testSelectedVoice = async () => {
    const vs = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || voices || [];
    const voice = vs.find((v) => v.voiceURI === selectedVoiceURI || v.name === selectedVoiceURI);
    if (!voice) {
      toast.error("Selected voice not found");
      return;
    }
    // Short test utterance
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance("This is a voice test.");
      u.voice = voice;
      u.lang = voice.lang || (navigator.language || "en-US");
      u.rate = 0.95;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.error("testSelectedVoice error", e);
      toast.error("Test failed");
    }
  };

  // ActionButtons
  const ActionButtons = () => (
    <div className="flex items-center gap-3 mt-2 text-xs text-purple-600 dark:text-purple-400 select-none">
      {!message.isImage && message.role === "assistant" && (
        <button
          onClick={() => { if (speaking) stopSpeaking(); else speakText(stripMarkdown(message.content)); }}
          className="flex items-center gap-1 hover:text-purple-800"
          type="button"
          title={speaking ? "Stop speaking" : "Speak"}
          aria-pressed={speaking}
        >
          {speaking ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="4" height="12" rx="1" />
              <rect x="14" y="6" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 8H3v8h3l5 3V5z" />
              <path strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" d="M19 9a3 3 0 010 6" />
            </svg>
          )}
          <span className="text-purple-600">{speaking ? "stop" : "speak"}</span>
        </button>
      )}

      <button onClick={handleCopy} className="flex items-center gap-1 hover:text-purple-800" type="button" title="Copy">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            d="M8 16.5H6.75A2.25 2.25 0 014.5 14.25V6.75A2.25 2.25 0 016.75 4.5h7.5A2.25 2.25 0 0116.5 6.75V8M8.25 19.5h9A2.25 2.25 0 0019.5 17.25v-9A2.25 2.25 0 0017.25 6h-9A2.25 2.25 0 006 8.25v9A2.25 2.25 0 008.25 19.5z" />
        </svg>
        <span className="text-purple-600">Copy</span>
      </button>

      <button onClick={handleLike} className={`flex items-center gap-1 transition hover:text-purple-800`} type="button" title="Like" aria-pressed={liked}>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M6.633 10.5h2.864l.905-4.856a2.25 2.25 0 014.426.722v4.134h3.198a1.5 1.5 0 011.474 1.818l-1.2 6A1.5 1.5 0 0116.75 19.5h-8.25a1.5 1.5 0 01-1.474-1.182l-1.2-6a1.5 1.5 0 011.474-1.818z" />
        </svg>
        <span className={`text-purple-600 ${liked ? "text-purple-800" : ""}`}>Like</span>
      </button>

      <button onClick={handleDislike} className={`flex items-center gap-1 transition hover:text-purple-800`} type="button" title="Dislike" aria-pressed={disliked}>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17.367 13.5h-2.864l-.905 4.856a2.25 2.25 0 01-4.426-.722V13.5H5.974a1.5 1.5 0 01-1.474-1.818l1.2-6A1.5 1.5 0 016.75 4.5h8.25a1.5 1.5 0 011.474 1.182l1.2 6A1.5 1.5 0 0117.367 13.5z" />
        </svg>
        <span className={`text-purple-600 ${disliked ? "text-red-500" : ""}`}>Dislike</span>
      </button>

      <button onClick={handleShareWhatsApp} className="flex items-center gap-1 hover:text-purple-800 transition" type="button" title="Share to WhatsApp">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-90" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2C6.48 2 2 6.48 2 12.04c0 1.99.52 3.84 1.49 5.48L2 22l4.72-1.22A9.93 9.93 0 0012.04 22C17.6 22 22 17.52 22 11.96 22 6.4 17.6 2 12.04 2zm0 17.4c-1.78 0-3.47-.48-4.95-1.36l-.35-.21-2.8.72.75-2.73-.22-.36A7.1 7.1 0 014.94 12c0-3.33 2.7-6.03 6.05-6.03 3.34 0 6.04 2.7 6.04 6.03 0 3.34-2.7 6.04-6.04 6.04z"/>
          <path d="M17.22 14.37c-.3-.15-1.77-.87-2.04-.97-.27-.1-.46-.15-.65.15-.19.3-.73.97-.9 1.17-.17.19-.34.21-.64.07-.3-.15-1.26-.47-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.12.3-.31.46-.46.16-.15.21-.26.32-.43.11-.17.05-.32-.03-.45-.08-.12-.65-1.55-.89-2.13-.24-.56-.49-.48-.67-.49l-.57-.01c-.19 0-.5.07-.76.34-.26.27-1 1-1 2.45s1.03 2.85 1.18 3.05c.15.2 2.04 3.2 4.94 4.48 2.69 1.19 2.69.79 3.18.74.49-.05 1.77-.72 2.02-1.41.25-.69.25-1.29.17-1.41-.08-.12-.29-.19-.6-.34z"/>
        </svg>
        <span className="text-purple-600">Share</span>
      </button>

      {message.isImage && (
        <button onClick={downloadImage} className="flex items-center gap-1 hover:text-purple-800 transition" type="button" title="Download image" disabled={downloading}>
          {downloading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 15v4a1 1 0 001 1h16a1 1 0 001-1v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          )}
          <span className="text-purple-600">{downloading ? "Downloading..." : "Download"}</span>
        </button>
      )}

      {/* Debug toggle */}
      <button onClick={() => setDebugOpen((s) => !s)} className="ml-1 text-xs px-2 py-1 border rounded">
        {debugOpen ? "Hide Voice Debug" : "Voice Debug"}
      </button>
    </div>
  );

  // --- Debug panel UI ---
  const VoiceDebugPanel = () => {
    const vs = (window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || voices || [];
    return (
      <div className="mt-2 p-2 border rounded bg-white dark:bg-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <button onClick={listVoices} className="px-2 py-1 border rounded">List voices</button>
          <button onClick={() => setSelectedVoiceURI("auto")} className="px-2 py-1 border rounded">Auto</button>
          <select value={selectedVoiceURI} onChange={(e) => setSelectedVoiceURI(e.target.value)} className="px-2 py-1 border rounded">
            <option value="auto">-- choose voice (auto) --</option>
            {vs.map((v, i) => <option key={i} value={v.voiceURI || v.name}>{v.name} ({v.lang}){v.default ? " [default]" : ""}</option>)}
          </select>
          <button onClick={testSelectedVoice} className="px-2 py-1 border rounded">Test voice</button>
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-300">
          Last list: {lastVoiceListTime ? new Date(lastVoiceListTime).toLocaleTimeString() : "never"} — Voices count: {vs.length}
          <pre className="mt-2 text-xs max-h-40 overflow-auto bg-black/5 p-2 rounded">{vs.map((v) => `${v.name} — ${v.lang} ${v.default ? "[default]" : ""} ${v.localService ? "[local]" : ""}`).join("\n")}</pre>
        </div>
      </div>
    );
  };

  // --- Render ---
  return (
    <div>
      {message.role === "user" ? (
        <div className="flex items-start justify-end my-4 gap-2">
          <div className="flex flex-col gap-2 p-2 px-4 bg-slate-50 dark:bg-[#57317C]/30 border border-[#80609F]/30 rounded-md max-w-2xl">
            <p className="text-sm dark:text-primary whitespace-pre-wrap">{message.content}</p>
            <span className="text-xs text-gray-400 dark:text-[#B1A6C0]">{moment(message.timestamp).fromNow()}</span>
          </div>
          <img src={assets.user_icon} className="w-8 rounded-full" alt="user" />
        </div>
      ) : (
        <div className="inline-flex flex-col gap-2 p-3 px-4 max-w-2xl bg-primary/20 dark:bg-[#57317C]/30 border border-[#80609F]/30 rounded-md my-4">
          {message.isImage ? (
            <img src={message.content} className="w-full max-w-md mt-2 rounded-md" alt="generated" />
          ) : (
            <div className="text-sm dark:text-primary reset-tw">
              <Markdown>{message.content}</Markdown>
            </div>
          )}

          <span className="text-xs text-gray-400 dark:text-[#B1A6C0]">{moment(message.timestamp).fromNow()}</span>

          <ActionButtons />

          {debugOpen && <VoiceDebugPanel />}
        </div>
      )}
    </div>
  );
};

export default Message;
