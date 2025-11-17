// src/components/Message.jsx
import React, { useEffect, useRef, useState } from "react";
import moment from "moment";
import Markdown from "react-markdown";
import Prism from "prismjs";
import toast from "react-hot-toast";
import { assets } from "../assets/assets";

/**
 * Message component (updated mobile speech handling)
 */
const Message = ({ message }) => {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // speech state & voices
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI] = useState("auto");
  const utteranceRef = useRef(null);
  const voicesPollRef = useRef(null);
  const initDoneRef = useRef(false);

  useEffect(() => {
    try {
      Prism.highlightAll();
    } catch (e) {}
  }, [message.content]);

  // ---- Init speech on first user gesture (important for mobile) ----
  useEffect(() => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    const initSpeech = () => {
      if (initDoneRef.current) return;
      initDoneRef.current = true;
      console.info("[Speech] initSpeech triggered by user gesture");

      // Try immediate load
      tryLoadVoices();

      // also try voiceschanged listener
      try {
        const onVoicesChanged = () => {
          tryLoadVoices();
        };
        window.speechSynthesis.addEventListener?.("voiceschanged", onVoicesChanged);
        // keep a reference so we can remove the same listener on cleanup
        voicesPollRef.current = { onVoicesChanged };
      } catch (e) {
        // older browsers fallback
        window.speechSynthesis.onvoiceschanged = tryLoadVoices;
      }

      // Poll for voices a bit longer (helpful on iOS)
      let attempts = 0;
      const poll = setInterval(() => {
        attempts += 1;
        if (tryLoadVoices() || attempts >= 20) {
          clearInterval(poll);
        }
      }, 250);
    };

    const onFirstTouchOrClick = (ev) => {
      // A user gesture — prime voices
      initSpeech();
      // remove listeners
      document.removeEventListener("touchstart", onFirstTouchOrClick, true);
      document.removeEventListener("click", onFirstTouchOrClick, true);
    };

    document.addEventListener("touchstart", onFirstTouchOrClick, { passive: true, capture: true });
    document.addEventListener("click", onFirstTouchOrClick, { passive: true, capture: true });

    // Also attempt immediate load for desktop (no gesture needed normally)
    tryLoadVoices();

    return () => {
      try {
        document.removeEventListener("touchstart", onFirstTouchOrClick, true);
        document.removeEventListener("click", onFirstTouchOrClick, true);
        if (voicesPollRef.current?.onVoicesChanged) {
          window.speechSynthesis.removeEventListener?.("voiceschanged", voicesPollRef.current.onVoicesChanged);
        } else {
          window.speechSynthesis.onvoiceschanged = null;
        }
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Robust load voices function (used by event listener + polling)
  const tryLoadVoices = () => {
    try {
      const v = window.speechSynthesis.getVoices() || [];
      if (v.length > 0) {
        const sorted = v.slice().sort((a, b) => {
          if (a.lang === b.lang) return (a.name || "").localeCompare(b.name || "");
          return (a.lang || "").localeCompare(b.lang || "");
        });
        // update only if different length (avoid rerenders)
        setVoices((prev) => {
          if (!prev || prev.length !== sorted.length) return sorted;
          return prev;
        });
        console.info(`[Speech] loaded ${v.length} voices`);
        return true;
      }
    } catch (err) {
      console.warn("tryLoadVoices error", err);
    }
    return false;
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
      } catch (e) {}
    };
  }, []);

  // utility: strip markdown for speak and share
  const stripMarkdown = (md = "") => {
    return md
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      .replace(/(^|\n)#+\s*/g, "$1")
      .replace(/(\*|_){1,3}([^*_]+)\1{1,3}/g, "$2")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .trim();
  };

  // language heuristic & voice selection
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

  const findBestVoiceForLang = (targetLang) => {
    if (!voices || voices.length === 0) return null;
    const exact = voices.find((v) => v.lang && v.lang.toLowerCase() === targetLang.toLowerCase());
    if (exact) return exact;
    const prefix = (targetLang || "").split("-")[0].toLowerCase();
    const prefixMatch = voices.find((v) => v.lang && (v.lang || "").split("-")[0].toLowerCase() === prefix);
    if (prefixMatch) return prefixMatch;
    return voices[0];
  };

  // speak text
  const speakText = (text) => {
    if (!text) return;
    if (!("speechSynthesis" in window)) {
      toast.error("Speech synthesis not supported in this browser.");
      return;
    }

    // Cancel any previous speech
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}

    // Re-fetch voices just before speaking (helps with late arrival)
    let currentVoices = [];
    try {
      currentVoices = window.speechSynthesis.getVoices() || [];
      if (currentVoices.length > 0) {
        const sorted = currentVoices.slice().sort((a, b) => {
          if (a.lang === b.lang) return (a.name || "").localeCompare(b.name || "");
          return (a.lang || "").localeCompare(b.lang || "");
        });
        setVoices((prev) => (prev.length === sorted.length ? prev : sorted));
      }
    } catch (e) {
      console.warn("getVoices() before speak error", e);
    }

    // If voices still empty on mobile, warn user (but try speaking anyway)
    if ((voices.length === 0 || currentVoices.length === 0) && !initDoneRef.current) {
      // Not primed — show toast recommending a tap first (but we also attempt speak)
      toast("Tap anywhere once and then try Speak again (mobile voice access).");
      // still continue to attempt speak
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // pick voice
    let chosenVoice = null;
    if (selectedVoiceURI && selectedVoiceURI !== "auto") {
      chosenVoice =
        (currentVoices || voices || []).find((v) => v.voiceURI === selectedVoiceURI || v.name === selectedVoiceURI) ||
        null;
    } else {
      const targetLang = detectLangCodeFromText(text);
      chosenVoice = findBestVoiceForLang(targetLang);
      if (!chosenVoice && currentVoices.length > 0) {
        chosenVoice = currentVoices.find((v) => (v.lang || "").split("-")[0] === (targetLang || "").split("-")[0]) || currentVoices[0];
      }
    }

    if (chosenVoice) {
      try {
        utterance.voice = chosenVoice;
        if (chosenVoice.lang) utterance.lang = chosenVoice.lang;
      } catch (e) {
        console.warn("assign voice failed, fallback to lang only", e);
        utterance.lang = navigator.language || "en-US";
      }
    } else {
      utterance.lang = navigator.language || "en-US";
    }

    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      utteranceRef.current = null;
    };
    utterance.onerror = (err) => {
      console.error("Speech error", err);
      setSpeaking(false);
      utteranceRef.current = null;
      toast.error("Speech failed");
    };

    utteranceRef.current = utterance;
    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("speak exception", e);
      toast.error("Could not start speech on this device/browser.");
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

  // ---------- COPY ----------
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

  // likes/dislikes, share, download are unchanged (kept minimal here)
  const handleLike = () => {
    setLiked(true);
    setDisliked(false);
    toast.success("Marked as helpful");
  };
  const handleDislike = () => {
    setDisliked(true);
    setLiked(false);
    toast("Thanks for your feedback!");
  };

  const openWhatsAppShare = (text) => {
    const encoded = encodeURIComponent(text);
    const mobileUrl = `whatsapp://send?text=${encoded}`;
    const webUrl = `https://wa.me/?text=${encoded}`;

    const newWindow = window.open(mobileUrl, "_blank");
    setTimeout(() => {
      if (!newWindow) {
        window.open(webUrl, "_blank");
      }
    }, 300);
  };

  const handleShareWhatsApp = () => {
    let textToShare = "";
    if (message.isImage) {
      textToShare = `${message.content}\n\n(Shared via QuickGPT)`;
    } else {
      const plain = stripMarkdown(message.content);
      const maxLen = 4000;
      const truncated = plain.length > maxLen ? plain.slice(0, maxLen) + "…" : plain;
      textToShare = `${truncated}\n\n(Shared via QuickGPT)`;
    }
    openWhatsAppShare(textToShare);
  };

  const downloadImage = async () => {
    if (!message.isImage || !message.content) {
      toast.error("No image to download");
      return;
    }
    try {
      setDownloading(true);
      const res = await fetch(message.content, { mode: "cors" });
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
      const blob = await res.blob();
      const urlParts = message.content.split("/").filter(Boolean);
      let filename = urlParts[urlParts.length - 1] || `image-${Date.now()}.png`;
      if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(filename)) {
        filename = `${filename}.png`;
      }
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

  // ActionButtons (unchanged visually, uses speakText/stopSpeaking)
  const ActionButtons = () => {
    return (
      <div className="flex items-center gap-3 mt-2 text-xs text-purple-600 dark:text-purple-400 select-none">
        {!message.isImage && message.role === "assistant" && (
          <button
            onClick={() => {
              if (speaking) stopSpeaking();
              else {
                const plain = stripMarkdown(message.content);
                speakText(plain);
              }
            }}
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
      </div>
    );
  };

  // Render
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
        </div>
      )}
    </div>
  );
};

export default Message;
