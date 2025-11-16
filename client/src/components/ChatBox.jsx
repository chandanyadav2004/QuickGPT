import React, { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import Message from './Message'
import toast from 'react-hot-toast'

const ChatBox = () => {
  const containerRef = useRef(null)
  const recognitionRef = useRef(null)

  const { selectedChat, theme, user, axios, token, setUser } = useAppContext()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('text')
  const [isPublished, setIsPublished] = useState(false)

  // Mic state
  const [listening, setListening] = useState(false)
  const committedRef = useRef('') // value committed before listening (used for interim)

  const onSubmit = async (e) => {
    try {
      e.preventDefault()
      if (!user) {
        return toast('Login to send message')
      }
      if (!selectedChat) {
        return toast('Select a chat first')
      }

      setLoading(true)
      const promptCopy = prompt
      // append user's message locally
      setMessages(pre => [...pre, { role: 'user', content: prompt, timestamp: Date.now(), isImage: false }])
      // clear input for UX while request in-flight
      setPrompt('')

      const { data } = await axios.post(
        `/api/message/${mode}`,
        { chatId: selectedChat._id, prompt: promptCopy, isPublished },
        { headers: { Authorization: token } }
      )
      if (data.success) {
        setMessages(prev => [...prev, data.reply])
        // decrease credits
        if (mode === 'image') {
          setUser(prev => ({ ...prev, credits: prev.credits - 2 }))
        } else {
          setUser(prev => ({ ...prev, credits: prev.credits - 1 }))
        }
      } else {
        toast.error(data.message)
        setPrompt(promptCopy) // restore on failure
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
      // ensure prompt cleared after send
      setPrompt('')
    }
  }

  // populate messages when chat changes
  useEffect(() => {
    if (selectedChat) {
      setMessages(selectedChat.messages || [])
    }
  }, [selectedChat])

  // scroll to bottom when messages change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages])

  // Setup SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null
    if (!SpeechRecognition) {
      recognitionRef.current = null
      return
    }

    const recog = new SpeechRecognition()
    recog.continuous = false // false for single utterance per start
    recog.interimResults = true
    recog.lang = document.documentElement.lang || 'en-IN'

    recog.onstart = () => {
      setListening(true)
      // record committed prompt at start so interim only shows appended text
      committedRef.current = prompt || ''
    }

    recog.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript || ''
        if (event.results[i].isFinal) finalTranscript += t
        else interimTranscript += t
      }

      if (finalTranscript) {
        // Append final to the committed (before listen) content
        const base = committedRef.current ? committedRef.current.trim() + ' ' : ''
        const newValue = (base + finalTranscript.trim()).trim()
        setPrompt(newValue)
        // update committedRef to include new final
        committedRef.current = newValue
      } else {
        // show interim appended to the committed text
        const display = (committedRef.current ? committedRef.current + ' ' : '') + interimTranscript
        setPrompt(display)
      }
    }

    recog.onerror = (err) => {
      console.warn('SpeechRecognition error:', err)
      try { recog.stop() } catch (e) {}
      setListening(false)
    }

    recog.onend = () => {
      setListening(false)
      // clear committedRef? keep it so prompt retains final text
      // committedRef.current = ''
    }

    recognitionRef.current = recog

    return () => {
      try {
        recog.onresult = null
        recog.onerror = null
        recog.onend = null
        recog.onstart = null
        recog.stop && recog.stop()
      } catch (e) {}
      recognitionRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // initialize once

  // toggle mic listening
  const toggleMic = () => {
    const recog = recognitionRef.current
    if (!recog) {
      toast('Voice input not supported in this browser')
      return
    }

    if (listening) {
      try {
        recog.stop()
      } catch (e) {
        console.warn(e)
        setListening(false)
      }
    } else {
      // set committedRef to current prompt so interim is appended
      committedRef.current = prompt || ''
      try {
        recog.start()
      } catch (err) {
        // Some browsers reject start if called too quickly; try after short delay
        setTimeout(() => {
          try { recog.start() } catch (e) { console.warn('recog.start() failed', e) }
        }, 200)
      }
    }
  }

  return (
    <div className=' flex-1 flex flex-col justify-between m-5 md:m-10 xl:mx-30 max-md:mt-14 2xl:pr-40'>
      {/* Chat messages */}
      <div ref={containerRef} className=' flex-1 mb-5 overflow-y-scroll'>
        {messages.length === 0 && (
          <div className=' h-full flex flex-col items-center justify-center gap-2 text-primary'>
            <img src={theme === 'dark' ? assets.logo_full : assets.logo_full_dark} className=' w-full max-w-56 sm:max-w-68' alt="" />
            <p className=' mt-5 text-4xl sm:text-6xl text-center text-gray-400 dark:text-white'>Ask me anything</p>
          </div>
        )}

        {messages.map((message, index) => <Message key={index} message={message} />)}

        {/* Three Dots Loading */}
        {loading && <div className=' loader flex items-center  gap-1.5 '>
          <div className=" w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-white animate-bounce"></div>
          <div className=" w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-white animate-bounce"></div>
          <div className=" w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-white animate-bounce"></div>
        </div>}
      </div>

      {mode === 'image' && (
        <label className=' inline-flex items-center gap-2 mb-3 text-sm mx-auto'>
          <p className=' text-xs'>Publish Generated Image to Community</p>
          <input type="checkbox" className=' cursor-pointer' checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
        </label>
      )}

      {/* Prompt Input Box */}
      <form className=' bg-primary/20 dark:bg-[#583C79]/30 border border-primary dark:border-[#80609F]/30 rounded-full w-full max-w-2xl p-3 pl-4 mx-auto flex gap-4 items-center' onSubmit={onSubmit}>
        <select onChange={(e) => setMode(e.target.value)} value={mode} className=' text-sm pl-3 pr-2 outline-none' >
          <option value="text" className=' dark:bg-purple-900'>Text</option>
          <option value="image" className=' dark:bg-purple-900'>Image</option>
        </select>

        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          type="text"
          placeholder=" Type your prompt here..."
          className=" flex-1 w-full text-sm outline-none"
          required
        />

        {/* Mic Button */}
        <button
          type="button"
          onClick={toggleMic}
          className={` p-2 rounded-full transition-colors mr-1 ${listening ? 'bg-red-500 text-white' : 'bg-transparent'}`}
          title={listening ? 'Stop listening' : 'Start voice input'}
        >
          {/* Use your asset if available, fallback to emoji */}
          {assets.mic_icon ? (
            <img src={assets.mic_icon} alt="mic" className=" w-5 h-5" />
          ) : (
            <span style={{ fontSize: 18 }}>{listening ? '⏹' : '🎤'}</span>
          )}
        </button>

        <button className="" disabled={loading} type="submit">
          <img src={loading ? assets.stop_icon : assets.send_icon} className=' w-8 cursor-pointer' alt="" />
        </button>
      </form>
    </div>
  )
}

export default ChatBox
