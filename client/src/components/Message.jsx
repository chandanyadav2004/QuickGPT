import React, { useEffect, useState } from "react";
import { assets } from "../assets/assets";
import moment from "moment";
import Markdown from "react-markdown";
import Prism from "prismjs";
import toast from "react-hot-toast";

const Message = ({ message }) => {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  useEffect(() => {
    Prism.highlightAll();
  }, [message.content]);

  // Copy function
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Like / Dislike Handlers
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

 const ActionButtons = () => (
  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 dark:text-gray-300">

    {/* COPY */}
    <button onClick={handleCopy} className="flex items-center gap-1 hover:text-white">
      {/** SVG Copy */}
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
          d="M8 16.5H6.75A2.25 2.25 0 014.5 14.25V6.75A2.25 2.25 0 016.75 4.5h7.5A2.25 2.25 0 0116.5 6.75V8M8.25 19.5h9A2.25 2.25 0 0019.5 17.25v-9A2.25 2.25 0 0017.25 6h-9A2.25 2.25 0 006 8.25v9A2.25 9 0 008.25 19.5z"
        />
      </svg>
      Copy
    </button>

    {/* LIKE */}
    <button
      onClick={handleLike}
      className={`flex items-center gap-1 ${liked ? "text-blue-500" : "hover:text-white"}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M6.633 10.5h2.864l.905-4.856a2.25 2.25 0 014.426.722v4.134h3.198a1.5 1.5 0 011.474 1.818l-1.2 6A1.5 1.5 0 0116.75 19.5h-8.25a1.5 1.5 0 01-1.474-1.182l-1.2-6a1.5 1.5 0 011.474-1.818z"
        />
      </svg>
      Like
    </button>

    {/* DISLIKE */}
    <button
      onClick={handleDislike}
      className={`flex items-center gap-1 ${disliked ? "text-red-500" : "hover:text-white"}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 opacity-75" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17.367 13.5h-2.864l-.905 4.856a2.25 2.25 0 01-4.426-.722V13.5H5.974a1.5 1.5 0 01-1.474-1.818l1.2-6A1.5 1.5 0 016.75 4.5h8.25a1.5 1.5 0 011.474 1.182l1.2 6A1.5 1.5 0 0117.367 13.5z"
        />
      </svg>
      Dislike
    </button>
  </div>
);

  return (
    <div>
      {message.role === "user" ? (
        /** ---------------- USER MESSAGE ---------------- */
        <div className="flex items-start justify-end my-4 gap-2">
          <div className="flex flex-col gap-2 p-2 px-4 bg-slate-50 dark:bg-[#57317C]/30 border border-[#80609F]/30 rounded-md max-w-2xl">
            <p className="text-sm dark:text-primary">{message.content}</p>

            <span className="text-xs text-gray-400 dark:text-[#B1A6C0]">
              {moment(message.timestamp).fromNow()}
            </span>
          </div>

          <img src={assets.user_icon} className="w-8 rounded-full" alt="" />
        </div>
      ) : (
        /** ---------------- AI / ASSISTANT MESSAGE ---------------- */
        <div className="inline-flex flex-col gap-2 p-3 px-4 max-w-2xl bg-primary/20 dark:bg-[#57317C]/30 border border-[#80609F]/30 rounded-md my-4">
          {message.isImage ? (
            <img
              src={message.content}
              className="w-full max-w-md mt-2 rounded-md"
              alt=""
            />
          ) : (
            <div className="text-sm dark:text-primary reset-tw">
              <Markdown>{message.content}</Markdown>
            </div>
          )}

          <span className="text-xs text-gray-400 dark:text-[#B1A6C0]">
            {moment(message.timestamp).fromNow()}
          </span>

          {/* Action buttons: Copy, Like, Dislike */}
          {!message.isImage && <ActionButtons />}
        </div>
      )}
    </div>
  );
};

export default Message;
