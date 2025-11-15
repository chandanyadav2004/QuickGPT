// src/components/Message.jsx
import React, { useEffect, useState } from "react";
import moment from "moment";
import Markdown from "react-markdown";
import Prism from "prismjs";
import toast from "react-hot-toast";
import { assets } from "../assets/assets";

/**
 * Message component
 * Props:
 *  - message: {
 *      role: 'user'|'assistant',
 *      content: string,   // text or image URL
 *      isImage?: boolean,
 *      timestamp: number,
 *      isPublished?: boolean
 *    }
 */
const Message = ({ message }) => {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    try {
      Prism.highlightAll();
    } catch (e) {
      // ignore if prism not applicable
    }
  }, [message.content]);

  // Simple markdown stripper for sharing text
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

  // ---------- LIKE / DISLIKE ----------
  const handleLike = () => {
    setLiked(true);
    setDisliked(false);
    toast.success("Marked as helpful");
    // TODO: optionally send to backend
  };

  const handleDislike = () => {
    setDisliked(true);
    setLiked(false);
    toast("Thanks for your feedback!");
    // TODO: optionally send to backend
  };

  // ---------- WHATSAPP SHARE ----------
  // tries mobile scheme first, falls back to web
  const openWhatsAppShare = (text) => {
    const encoded = encodeURIComponent(text);
    const mobileUrl = `whatsapp://send?text=${encoded}`;
    const webUrl = `https://wa.me/?text=${encoded}`;

    // Try to open mobile scheme
    const newWindow = window.open(mobileUrl, "_blank");

    // If mobile scheme didn't open (likely desktop), fallback to web
    setTimeout(() => {
      if (!newWindow) {
        window.open(webUrl, "_blank");
      }
    }, 300);
  };

  const handleShareWhatsApp = () => {
    let textToShare = "";

    if (message.isImage) {
      // For images share the direct URL and optional caption
      textToShare = `${message.content}\n\n(Shared via QuickGPT)`;
    } else {
      const plain = stripMarkdown(message.content);
      const maxLen = 4000;
      const truncated = plain.length > maxLen ? plain.slice(0, maxLen) + "…" : plain;
      textToShare = `${truncated}\n\n(Shared via QuickGPT)`;
    }

    openWhatsAppShare(textToShare);
  };

  // ---------- DOWNLOAD IMAGE ----------
  // Fetches the image as blob and triggers a download with a safe filename
  const downloadImage = async () => {
    if (!message.isImage || !message.content) {
      toast.error("No image to download");
      return;
    }

    try {
      setDownloading(true);

      // Try to fetch the image as blob
      const res = await fetch(message.content, { mode: "cors" });
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);

      const blob = await res.blob();

      // Derive filename from URL or timestamp
      const urlParts = message.content.split("/").filter(Boolean);
      let filename = urlParts[urlParts.length - 1] || `image-${Date.now()}.png`;
      // fallback to .png if no extension
      if (!/\.(png|jpe?g|webp|gif|svg)$/i.test(filename)) {
        filename = `${filename}.png`;
      }

      // Create object URL and click anchor to download
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

  // ---------- Small ActionButtons component ----------
  const ActionButtons = () => (
    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-300 select-none">
      {/* Copy */}
      <button onClick={handleCopy} className="flex items-center gap-1 hover:text-white" type="button" title="Copy">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            d="M8 16.5H6.75A2.25 2.25 0 014.5 14.25V6.75A2.25 2.25 0 016.75 4.5h7.5A2.25 2.25 0 0116.5 6.75V8M8.25 19.5h9A2.25 2.25 0 0019.5 17.25v-9A2.25 2.25 0 0017.25 6h-9A2.25 2.25 0 006 8.25v9A2.25 2.25 0 008.25 19.5z" />
        </svg>
        Copy
      </button>

      {/* Like */}
      <button onClick={handleLike} className={`flex items-center gap-1 transition ${liked ? "text-blue-500" : "hover:text-white"}`} type="button" title="Like" aria-pressed={liked}>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M6.633 10.5h2.864l.905-4.856a2.25 2.25 0 014.426.722v4.134h3.198a1.5 1.5 0 011.474 1.818l-1.2 6A1.5 1.5 0 0116.75 19.5h-8.25a1.5 1.5 0 01-1.474-1.182l-1.2-6a1.5 1.5 0 011.474-1.818z" />
        </svg>
        Like
      </button>

      {/* Dislike */}
      <button onClick={handleDislike} className={`flex items-center gap-1 transition ${disliked ? "text-red-500" : "hover:text-white"}`} type="button" title="Dislike" aria-pressed={disliked}>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17.367 13.5h-2.864l-.905 4.856a2.25 2.25 0 01-4.426-.722V13.5H5.974a1.5 1.5 0 01-1.474-1.818l1.2-6A1.5 1.5 0 016.75 4.5h8.25a1.5 1.5 0 011.474 1.182l1.2 6A1.5 1.5 0 0117.367 13.5z" />
        </svg>
        Dislike
      </button>

      {/* WhatsApp Share */}
      <button onClick={handleShareWhatsApp} className="flex items-center gap-1 hover:text-green-400 transition" type="button" title="Share to WhatsApp">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-90" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2C6.48 2 2 6.48 2 12.04c0 1.99.52 3.84 1.49 5.48L2 22l4.72-1.22A9.93 9.93 0 0012.04 22C17.6 22 22 17.52 22 11.96 22 6.4 17.6 2 12.04 2zm0 17.4c-1.78 0-3.47-.48-4.95-1.36l-.35-.21-2.8.72.75-2.73-.22-.36A7.1 7.1 0 014.94 12c0-3.33 2.7-6.03 6.05-6.03 3.34 0 6.04 2.7 6.04 6.03 0 3.34-2.7 6.04-6.04 6.04z"/>
          <path d="M17.22 14.37c-.3-.15-1.77-.87-2.04-.97-.27-.1-.46-.15-.65.15-.19.3-.73.97-.9 1.17-.17.19-.34.21-.64.07-.3-.15-1.26-.47-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.12.3-.31.46-.46.16-.15.21-.26.32-.43.11-.17.05-.32-.03-.45-.08-.12-.65-1.55-.89-2.13-.24-.56-.49-.48-.67-.49l-.57-.01c-.19 0-.5.07-.76.34-.26.27-1 1-1 2.45s1.03 2.85 1.18 3.05c.15.2 2.04 3.2 4.94 4.48 2.69 1.19 2.69.79 3.18.74.49-.05 1.77-.72 2.02-1.41.25-.69.25-1.29.17-1.41-.08-.12-.29-.19-.6-.34z"/>
        </svg>
        Share
      </button>

      {/* Download (only for images) */}
      {message.isImage && (
        <button onClick={downloadImage} className="flex items-center gap-1 hover:text-white transition" type="button" title="Download image" disabled={downloading}>
          {downloading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 15v4a1 1 0 001 1h16a1 1 0 001-1v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          )}
          {downloading ? "Downloading..." : "Download"}
        </button>
      )}
    </div>
  );

  // ---------- Render ----------
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

          {/* show actions for both text and images (download appears only for images) */}
          <ActionButtons />
        </div>
      )}
    </div>
  );
};

export default Message;
