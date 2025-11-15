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
 *  - message: { role: 'user'|'assistant', content: string, isImage?: boolean, timestamp: number, isPublished?: boolean }
 */
const Message = ({ message }) => {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  useEffect(() => {
    // highlight code blocks if any (Prism)
    try {
      Prism.highlightAll();
    } catch (e) {
      // ignore if prism not applicable
    }
  }, [message.content]);

  // copy plain text (for images, copy URL)
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

  // Like / Dislike toggle handlers (local-only)
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

  // Basic strip-markdown for sharing (removes common markdown chars)
  const stripMarkdown = (md) => {
    if (!md) return "";
    // Very basic strip: remove code fences, inline code, headings, links, images, bold/italic, lists
    return md
      .replace(/```[\s\S]*?```/g, "") // code fences
      .replace(/`([^`]+)`/g, "$1") // inline code
      .replace(/!\[.*?\]\(.*?\)/g, "") // images
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)") // links => text (url)
      .replace(/(^|\n)#+\s*/g, "$1") // headings
      .replace(/(\*|_){1,3}([^*_]+)\1{1,3}/g, "$2") // bold/italic
      .replace(/^\s*[-*+]\s+/gm, "") // lists bullets
      .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
      .trim();
  };

  // WhatsApp share helper: tries mobile scheme then web fallback
  const openWhatsAppShare = (text) => {
    const encoded = encodeURIComponent(text);
    const mobileUrl = `whatsapp://send?text=${encoded}`;
    const webUrl = `https://wa.me/?text=${encoded}`;

    // Try opening mobile scheme first. If it fails (desktop), open web after a small delay.
    const newWindow = window.open(mobileUrl, "_blank");

    setTimeout(() => {
      // If popup blocked or didn't open, fallback to web url
      if (!newWindow) {
        window.open(webUrl, "_blank");
      }
    }, 300);
  };

  const handleShareWhatsApp = () => {
    const isImage = !!message.isImage;
    let textToShare = "";

    if (isImage) {
      // Share the image URL + optional caption
      textToShare = `${message.content}\n\n(Shared via QuickGPT)`;
    } else {
      const plain = stripMarkdown(message.content);
      // limit length for WhatsApp, optional
      const maxLen = 4000;
      const truncated = plain.length > maxLen ? plain.slice(0, maxLen) + "…" : plain;
      textToShare = `${truncated}\n\n(Shared via QuickGPT)`;
    }

    openWhatsAppShare(textToShare);
  };

  // small UI for action buttons (reused)
  const ActionButtons = () => (
    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 dark:text-gray-300 select-none">
      {/* COPY */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 hover:text-white transition"
        aria-label="Copy message"
        title="Copy"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            d="M8 16.5H6.75A2.25 2.25 0 014.5 14.25V6.75A2.25 2.25 0 016.75 4.5h7.5A2.25 2.25 0 0116.5 6.75V8M8.25 19.5h9A2.25 2.25 0 0019.5 17.25v-9A2.25 2.25 0 0017.25 6h-9A2.25 2.25 0 006 8.25v9A2.25 2.25 0 008.25 19.5z" />
        </svg>
        Copy
      </button>

      {/* LIKE */}
      <button
        onClick={handleLike}
        className={`flex items-center gap-1 transition ${liked ? "text-blue-500" : "hover:text-white"}`}
        aria-pressed={liked}
        title="Like"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M6.633 10.5h2.864l.905-4.856a2.25 2.25 0 014.426.722v4.134h3.198a1.5 1.5 0 011.474 1.818l-1.2 6A1.5 1.5 0 0116.75 19.5h-8.25a1.5 1.5 0 01-1.474-1.182l-1.2-6a1.5 1.5 0 011.474-1.818z" />
        </svg>
        Like
      </button>

      {/* DISLIKE */}
      <button
        onClick={handleDislike}
        className={`flex items-center gap-1 transition ${disliked ? "text-red-500" : "hover:text-white"}`}
        aria-pressed={disliked}
        title="Dislike"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17.367 13.5h-2.864l-.905 4.856a2.25 2.25 0 01-4.426-.722V13.5H5.974a1.5 1.5 0 01-1.474-1.818l1.2-6A1.5 1.5 0 016.75 4.5h8.25a1.5 1.5 0 011.474 1.182l1.2 6A1.5 1.5 0 0117.367 13.5z" />
        </svg>
        Dislike
      </button>

      {/* WHATSAPP SHARE */}
      <button
        onClick={handleShareWhatsApp}
        className="flex items-center gap-1 hover:text-green-400 transition"
        title="Share to WhatsApp"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-90" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.04 2C6.48 2 2 6.48 2 12.04c0 1.99.52 3.84 1.49 5.48L2 22l4.72-1.22A9.93 9.93 0 0012.04 22C17.6 22 22 17.52 22 11.96 22 6.4 17.6 2 12.04 2zm0 17.4c-1.78 0-3.47-.48-4.95-1.36l-.35-.21-2.8.72.75-2.73-.22-.36A7.1 7.1 0 014.94 12c0-3.33 2.7-6.03 6.05-6.03 3.34 0 6.04 2.7 6.04 6.03 0 3.34-2.7 6.04-6.04 6.04z"/>
          <path d="M17.22 14.37c-.3-.15-1.77-.87-2.04-.97-.27-.1-.46-.15-.65.15-.19.3-.73.97-.9 1.17-.17.19-.34.21-.64.07-.3-.15-1.26-.47-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.12.3-.31.46-.46.16-.15.21-.26.32-.43.11-.17.05-.32-.03-.45-.08-.12-.65-1.55-.89-2.13-.24-.56-.49-.48-.67-.49l-.57-.01c-.19 0-.5.07-.76.34-.26.27-1 1-1 2.45s1.03 2.85 1.18 3.05c.15.2 2.04 3.2 4.94 4.48 2.69 1.19 2.69.79 3.18.74.49-.05 1.77-.72 2.02-1.41.25-.69.25-1.29.17-1.41-.08-.12-.29-.19-.6-.34z"/>
        </svg>
        Share
      </button>
    </div>
  );

  return (
    <div>
      {message.role === "user" ? (
        <div className="flex items-start justify-end my-4 gap-2">
          <div className="flex flex-col gap-2 p-2 px-4 bg-slate-50 dark:bg-[#57317C]/30 border border-[#80609F]/30 rounded-md max-w-2xl">
            <p className="text-sm dark:text-primary whitespace-pre-wrap">
              {message.content}
            </p>
            <span className="text-xs text-gray-400 dark:text-[#B1A6C0]">
              {moment(message.timestamp).fromNow()}
            </span>
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

          <span className="text-xs text-gray-400 dark:text-[#B1A6C0]">
            {moment(message.timestamp).fromNow()}
          </span>

          {/* Only show actions for non-image messages (you can also show for images if you like) */}
          {!message.isImage && <ActionButtons />}
        </div>
      )}
    </div>
  );
};

export default Message;
