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

  // -------------------------------
  // Auto-create a new chat on app load (keep previous chats)
  // -------------------------------
  useEffect(() => {
    if (!user) return;
    if (autoCreated) return;

    let cancelled = false;

    (async () => {
      try {
        // try to create a new chat; many implementations return the created chat object
        const created = await createNewChat();

        if (!cancelled && created && created._id) {
          // prepend new chat but avoid duplicates
          setChats((prev) => {
            const filtered = prev ? prev.filter((c) => c._id !== created._id) : [];
            return [created, ...filtered];
          });
          setSelectedChat(created);
          navigate("/");
          setAutoCreated(true);
          return;
        }

        // fallback: if createNewChat didn't return created object, fetch latest chats
        if (!cancelled && typeof fetchUserChats === "function") {
          const latest = await fetchUserChats(); // may set chats internally or return array
          const latestChats = Array.isArray(latest) ? latest : (chats || []);
          if (latestChats.length > 0) {
            const newest = latestChats
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
              )[0];
            if (newest) {
              setChats((prev) => {
                const filtered = prev ? prev.filter((c) => c._id !== newest._id) : [];
                return [newest, ...filtered];
              });
              setSelectedChat(newest);
              navigate("/");
              setAutoCreated(true);
              return;
            }
          }
        }

        // mark done to avoid retry loops
        setAutoCreated(true);
      } catch (err) {
        console.error("Auto-create chat failed:", err);
        setAutoCreated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    toast.success("Logout Successfully");
  };

  const deleteChat = async (e, chatId) => {
    try {
      e.stopPropagation();
      const confirm = window.confirm(
        "Are you sure you want to delete this chat?"
      );
      if (!confirm) return;

      const { data } = await axios.post(
        "/api/chat/delete",
        { chatId },
        { headers: { Authorization: token } }
      );

      if (data.success) {
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
      {/* Logo */}
      <img
        src={theme === "dark" ? assets.logo_full : assets.logo_full_dark}
        alt="logo"
        className="w-full max-w-48"
      />

      {/* New Chat Button */}
      <button
        onClick={createNewChat}
        className="flex justify-center items-center w-full py-2 mt-10 
        text-white bg-gradient-to-r from-[#A456F7] to-[#3081F6] 
        text-sm rounded-md cursor-pointer"
      >
        <span className="mr-2 text-xl">+</span> New Chat
      </button>

      {/* Search Input */}
      <div className="flex items-center gap-2 p-3 mt-4 border border-gray-400 dark:border-white/20 rounded-md">
        <img src={assets.search_icon} className="w-4 not-dark:invert" alt="" />

        <input
          ref={searchRef}
          type="text"
          placeholder=" Search conversation"
          className="text-xs placeholder:text-gray-400 outline-none flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Clear Button */}
        {search.length > 0 && (
          <button
            onClick={() => {
              setSearch("");
              searchRef.current?.focus();
            }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-[#ffffff15] transition"
          >
            <img
              src={assets.close_icon}
              className="w-3 h-3 not-dark:invert"
              alt="clear"
            />
          </button>
        )}
      </div>

      {/* Recent Chats */}
      {chats.length > 0 && <p className="mt-4 text-sm">Recent Chats</p>}

      <div className="flex-1 overflow-y-scroll mt-3 text-sm space-y-3">
        {chats
          .filter((chat) =>
            chat.messages[0]
              ? chat.messages[0]?.content
                  .toLowerCase()
                  .includes(search.toLowerCase())
              : chat.name.toLowerCase().includes(search.toLowerCase())
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
              dark:border-[#80609F]/15 rounded-md cursor-pointer flex justify-between group"
            >
              <div>
                <p className="truncate w-full">
                  {chat.messages.length > 0
                    ? chat.messages[0].content.slice(0, 32)
                    : chat.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-[#B1A6C0]">
                  {moment(chat.updatedAt).fromNow()}
                </p>
              </div>

              <img
                src={assets.bin_icon}
                onClick={(e) =>
                  toast.promise(deleteChat(e, chat._id), {
                    loading: "deleting...",
                  })
                }
                className="hidden group-hover:block w-4 cursor-pointer not-dark:invert"
                alt="delete"
              />
            </div>
          ))}
      </div>

      {/* Community Images */}
      <div
        onClick={() => {
          navigate("/community");
          setIsMenuOpen(false);
        }}
        className="flex items-center gap-2 p-3 mt-4 border border-gray-300 
        dark:border-white/15 rounded-md cursor-pointer hover:scale-103 transition-all"
      >
        <img
          src={assets.gallery_icon}
          className="w-4.5 not-dark:invert"
          alt="gallery"
        />
        <div className="flex flex-col text-sm">
          <p>Community Images</p>
        </div>
      </div>

      {/* Credits */}
      <div
        onClick={() => {
          navigate("/credits");
          setIsMenuOpen(false);
        }}
        className="flex items-center gap-2 p-3 mt-4 border border-gray-300 
        dark:border-white/15 rounded-md cursor-pointer hover:scale-103 transition-all"
      >
        <img src={assets.diamond_icon} className="w-4.5 dark:invert" alt="" />
        <div className="flex flex-col text-sm">
          <p>Credits : {user?.credits}</p>
          <p className="text-xs text-gray-400">
            Purchase credits to use quickgpt
          </p>
        </div>
      </div>

      {/* Dark Mode Toggle */}
      <div className="flex items-center justify-between gap-2 p-3 mt-4 border border-gray-300 dark:border-white/15 rounded-md">
        <div className="flex items-center gap-2 text-sm">
          <img src={assets.theme_icon} className="w-4.5 not-dark:invert" alt="" />
          <p>Dark Mode</p>
        </div>

        <label className="relative inline-flex cursor-pointer">
          <input
            onChange={() => setTheme(theme === "dark" ? "light" : "dark")}
            type="checkbox"
            className="sr-only peer"
            checked={theme === "dark"}
          />
          <div className="w-9 h-5 bg-gray-400 rounded-full peer-checked:bg-purple-600 transition-all"></div>

          <span className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
        </label>
      </div>

      {/* User Info */}
      <div className="flex items-center gap-3 p-3 mt-4 border border-gray-300 
      dark:border-white/15 rounded-md cursor-pointer group">
        <img src={assets.user_icon} className="w-7 rounded-full" alt="user" />
        <p className="flex-1 text-sm dark:text-primary truncate">
          {user ? user.name : "Login your account"}
        </p>

        {user && (
          <img
            onClick={logout}
            src={assets.logout_icon}
            className="h-5 cursor-pointer not-dark:invert group-hover:block"
          />
        )}
      </div>

      {/* Close Sidebar */}
      <img
        onClick={() => setIsMenuOpen(false)}
        src={assets.close_icon}
        className="absolute top-3 right-3 w-5 h-5 cursor-pointer md:hidden not-dark:invert"
        alt="close"
      />
    </div>
  );
};

export default Sidebar;
