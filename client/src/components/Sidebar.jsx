import React, { useState, useRef, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";
import moment from "moment";
import toast from "react-hot-toast";

const Sidebar = ({ isMenuOpen, setIsMenuOpen }) => {
  const {
    chats,
    setSelectedChat,
    theme,
    setTheme,
    user,
    navigate,
    createNewChat,
    axios,
    token,
    setChats,
    fetchUserChats,
    setToken,
  } = useAppContext();

  const [search, setSearch] = useState("");
  const searchRef = useRef(null);
  const [autoCreated, setAutoCreated] = useState(false);

  // Auto-delete timeout
  const AUTO_DELETE_MINUTES = 15;
  const deletionTimersRef = useRef({});

  const scheduleDeletionForEmptyChat = (chatId, ms = AUTO_DELETE_MINUTES * 60 * 1000) => {
    if (deletionTimersRef.current[chatId]) return;

    const timeoutId = setTimeout(async () => {
      try {
        const currentChat = (chats || []).find((c) => c._id === chatId);
        if (!currentChat) return cleanupTimer(chatId);

        const hasMessages = Array.isArray(currentChat.messages) && currentChat.messages.length > 0;
        const emptyMsg = hasMessages ? !currentChat.messages[0]?.content?.trim?.() : true;

        if (!hasMessages || emptyMsg) {
          try {
            const { data } = await axios.post(
              "/api/chat/delete",
              { chatId },
              { headers: { Authorization: token } }
            );

            if (data?.success) {
              setChats((prev) => prev.filter((c) => c._id !== chatId));
              if (typeof fetchUserChats === "function") await fetchUserChats();
            }
          } catch (err) {
            console.warn("Auto-delete failed:", err);
          }
        }
      } finally {
        cleanupTimer(chatId);
      }
    }, ms);

    deletionTimersRef.current[chatId] = timeoutId;
  };

  const cleanupTimer = (chatId) => {
    const t = deletionTimersRef.current[chatId];
    if (t) {
      clearTimeout(t);
      delete deletionTimersRef.current[chatId];
    }
  };

  useEffect(() => {
    if (!chats || chats.length === 0) return;
    chats.forEach((chat) => {
      if (chat.messages.length > 0 && deletionTimersRef.current[chat._id]) {
        cleanupTimer(chat._id);
      }
    });
  }, [chats]);

  const handleCreateNewChat = async (timeoutMinutes = AUTO_DELETE_MINUTES) => {
    try {
      const created = await createNewChat();
      let createdChat = created;

      if (!createdChat?._id && typeof fetchUserChats === "function") {
        const latest = await fetchUserChats();
        const sorted = Array.isArray(latest) ? latest : chats || [];
        createdChat = sorted.sort(
          (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        )[0];
      }

      if (createdChat?._id) {
        setChats((prev) => [createdChat, ...(prev?.filter((c) => c._id !== createdChat._id) || [])]);
        setSelectedChat(createdChat);
        navigate("/");
        scheduleDeletionForEmptyChat(createdChat._id, timeoutMinutes * 60 * 1000);
      }
    } catch (err) {
      toast.error("Failed to create chat");
    }
  };

  // Auto-create chat on load
  useEffect(() => {
    if (!user || autoCreated) return;
    let cancelled = false;

    (async () => {
      try {
        const created = await createNewChat();

        if (!cancelled && created?._id) {
          setChats((prev) => [created, ...(prev?.filter((c) => c._id !== created._id) || [])]);
          setSelectedChat(created);
          navigate("/");
          scheduleDeletionForEmptyChat(created._id);
          setAutoCreated(true);
          return;
        }

        if (!cancelled && typeof fetchUserChats === "function") {
          const latest = await fetchUserChats();
          const sorted = Array.isArray(latest) ? latest : chats || [];
          const newest = sorted.sort(
            (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
          )[0];

          if (newest) {
            setChats((prev) => [newest, ...(prev?.filter((c) => c._id !== newest._id) || [])]);
            setSelectedChat(newest);
            navigate("/");
            scheduleDeletionForEmptyChat(newest._id);
          }
        }
      } catch {
      } finally {
        setAutoCreated(true);
      }
    })();

    return () => (cancelled = true);
  }, [user]);

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    toast.success("Logout Successfully");
  };

  const deleteChat = async (e, chatId) => {
    e.stopPropagation();
    const confirmDelete = window.confirm("Are you sure you want to delete this chat?");
    if (!confirmDelete) return;

    try {
      const { data } = await axios.post(
        "/api/chat/delete",
        { chatId },
        { headers: { Authorization: token } }
      );

      if (data.success) {
        cleanupTimer(chatId);
        setChats((prev) => prev.filter((chat) => chat._id !== chatId));
        await fetchUserChats();
        toast.success(data.message);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div
      className={`flex flex-col h-screen min-w-72 p-5 dark:bg-gradient-to-b from-[#242124]/30 to-[#000000]/30 
      border-r border-[#80609F]/30 backdrop-blur-3xl transition-all duration-500 max-md:absolute left-0 z-1 ${
        !isMenuOpen && "max-md:-translate-x-full"
      } `}
    >
      <img
        src={theme === "dark" ? assets.logo_full : assets.logo_full_dark}
        alt="logo"
        className="w-full max-w-48"
      />

      <button
        onClick={() => handleCreateNewChat()}
        className="flex justify-center items-center w-full py-2 mt-10 
        text-white bg-gradient-to-r from-[#A456F7] to-[#3081F6] 
        text-sm rounded-md cursor-pointer"
      >
        <span className="mr-2 text-xl">+</span> New Chat
      </button>

      {/* Search */}
      <div className="flex items-center gap-2 p-3 mt-4 border border-gray-400 dark:border-white/20 rounded-md">
        <img src={assets.search_icon} className="w-4 not-dark:invert" alt="search" />
        <input
          ref={searchRef}
          type="text"
          placeholder=" Search conversation"
          className="text-xs placeholder:text-gray-400 outline-none flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search.length > 0 && (
          <button
            onClick={() => {
              setSearch("");
              searchRef.current?.focus();
            }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#ffffff15]"
          >
            <img src={assets.close_icon} className="w-3 h-3 not-dark:invert" alt="clear" />
          </button>
        )}
      </div>

      {chats.length > 0 && <p className="mt-4 text-sm">Recent Chats</p>}

      {/* CHAT LIST WITH FULL FIXED DELETE ICON LOGIC */}
      <div className="flex-1 overflow-y-scroll mt-3 text-sm space-y-3">
        {chats
          .filter((chat) =>
            chat.messages[0]
              ? chat.messages[0]?.content?.toLowerCase()?.includes(search.toLowerCase())
              : chat.name?.toLowerCase()?.includes(search.toLowerCase())
          )
          .map((chat) => (
            <div
              onClick={() => {
                navigate("/");
                setSelectedChat(chat);
                setIsMenuOpen(false);
              }}
              key={chat._id}
              className="p-2 px-4 dark:bg-[#57317C]/10 border border-gray-300 
                dark:border-[#80609F]/15 rounded-md cursor-pointer flex items-center justify-between group"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate">
                  {chat.messages.length > 0
                    ? chat.messages[0].content.slice(0, 32)
                    : chat.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-[#B1A6C0]">
                  {moment(chat.updatedAt).fromNow()}
                </p>
              </div>

              {/* MOBILE: always visible on the RIGHT */}
              <img
                src={assets.bin_icon}
                onClick={(e) =>
                  toast.promise(deleteChat(e, chat._id), { loading: "deleting..." })
                }
                className="md:hidden block w-4 ml-3 cursor-pointer not-dark:invert"
                alt="delete"
              />

              {/* DESKTOP: right side, hover only */}
              <img
                src={assets.bin_icon}
                onClick={(e) =>
                  toast.promise(deleteChat(e, chat._id), { loading: "deleting..." })
                }
                className="hidden md:block w-4 ml-3 cursor-pointer not-dark:invert group-hover:block opacity-0 group-hover:opacity-100 transition"
                alt="delete"
              />
            </div>
          ))}
      </div>

      {/* Bottom Items */}
      <div
        onClick={() => {
          navigate("/community");
          setIsMenuOpen(false);
        }}
        className="flex items-center gap-2 p-3 mt-4 border border-gray-300 
        dark:border-white/15 rounded-md cursor-pointer hover:scale-103"
      >
        <img src={assets.gallery_icon} className="w-4.5 not-dark:invert" />
        <div className="text-sm">Community Images</div>
      </div>

      <div
        onClick={() => {
          navigate("/credits");
          setIsMenuOpen(false);
        }}
        className="flex items-center gap-2 p-3 mt-4 border border-gray-300 
        dark:border-white/15 rounded-md cursor-pointer hover:scale-103"
      >
        <img src={assets.diamond_icon} className="w-4.5 dark:invert" />
        <div className="text-sm">
          <p>Credits : {user?.credits}</p>
          <p className="text-xs text-gray-400">Purchase credits to use quickgpt</p>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="flex items-center justify-between gap-2 p-3 mt-4 border border-gray-300 dark:border-white/15 rounded-md">
        <div className="flex items-center gap-2 text-sm">
          <img src={assets.theme_icon} className="w-4.5 not-dark:invert" />
          <p>Dark Mode</p>
        </div>

        <label className="relative inline-flex cursor-pointer">
          <input
            type="checkbox"
            onChange={() => setTheme(theme === "dark" ? "light" : "dark")}
            checked={theme === "dark"}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-400 rounded-full peer-checked:bg-purple-600"></div>
          <span className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
        </label>
      </div>

      {/* User */}
      <div className="flex items-center gap-3 p-3 mt-4 border border-gray-300 
      dark:border-white/15 rounded-md cursor-pointer group">
        <img src={assets.user_icon} className="w-7 rounded-full" />
        <p className="flex-1 text-sm truncate">{user ? user.name : "Login your account"}</p>

        {user && (
          <img
            onClick={logout}
            src={assets.logout_icon}
            className="h-5 cursor-pointer not-dark:invert"
          />
        )}
      </div>

      <img
        onClick={() => setIsMenuOpen(false)}
        src={assets.close_icon}
        className="absolute top-3 right-3 w-5 h-5 cursor-pointer md:hidden not-dark:invert"
      />
    </div>
  );
};

export default Sidebar;
