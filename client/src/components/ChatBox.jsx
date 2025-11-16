import React, { useEffect, useRef, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import Message from './Message'
import toast from 'react-hot-toast'

/**
 * ChatBox.jsx
 * - Shows suggestion list above prompt (ChatGPT-like)
 * - Click or keyboard-select a suggestion to prepend an instruction before current prompt
 * - Supports six tools: Summarize, Paraphrase, Grammar, Expand, Tone, Explain
 * - Keeps mic, send, message list, credits, tools panel behavior
 */

const ChatBox = () => {
  const containerRef = useRef(null)
  const recognitionRef = useRef(null)
  const promptRef = useRef(null)

  const { selectedChat, theme, user, axios, token, setUser } = useAppContext()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState('text')
  const [isPublished, setIsPublished] = useState(false)

  // Mic state
  const [listening, setListening] = useState(false)
  const committedRef = useRef('') // for interim speech results

  // Suggestions UI state
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState([])
  const [highlightIndex, setHighlightIndex] = useState(-1)

  // Quick summarizer visibility & options (keeps prior behavior)
  const [showSummarizerQuick, setShowSummarizerQuick] = useState(true)
  const [summaryLength, setSummaryLength] = useState('4line')
  const [summaryMode, setSummaryMode] = useState('bullet')

  // tools options map (persist choices when user opens tools)
  const [toolOptions, setToolOptions] = useState({})

  const setOption = (toolKey, optKey, value) => {
    setToolOptions(prev => ({ ...prev, [toolKey]: { ...(prev[toolKey] || {}), [optKey]: value } }))
  }

  // Suggestion presets (title, description, and generator for instruction)
  const SUGGESTIONS = [
    {
      id: 'summ-4-bullets',
      tool: 'summarizer',
      title: 'Summarize in 4 lines (bullets)',
      desc: 'Short summary in 4 bullet lines',
      build: (text) => `Summarize the following text in 4 concise lines. Output as bullet points:\n\n${text}`
    },
    {
      id: 'summ-1-line',
      tool: 'summarizer',
      title: 'Summarize in 1 line',
      desc: 'Very concise single line summary',
      build: (text) => `Summarize the following text in 1 concise line:\n\n${text}`
    },
    {
      id: 'summ-short-paragraph',
      tool: 'summarizer',
      title: 'Short summary (paragraph)',
      desc: 'Brief paragraph summary',
      build: (text) => `Summarize the following text (short) and present it in paragraph form:\n\n${text}`
    },
    {
      id: 'para-formal',
      tool: 'paraphrase',
      title: 'Paraphrase — Formal',
      desc: 'Rewrite text in a formal style',
      build: (text) => `Reword the following text in a Formal style while preserving the original meaning. Output only the rewritten text:\n\n${text}`
    },
    {
      id: 'para-simple',
      tool: 'paraphrase',
      title: 'Paraphrase — Simple',
      desc: 'Make text simpler and clearer',
      build: (text) => `Reword the following text in a Simple style while preserving meaning. Output only the rewritten text:\n\n${text}`
    },
    {
      id: 'grammar-check',
      tool: 'grammar',
      title: 'Grammar & Spell Check',
      desc: 'Detect mistakes and show corrections + explanations',
      build: (text) => `Check the following text for grammar, spelling, and punctuation mistakes. Provide corrections and brief explanations for each correction. Show before and after comparison:\n\n${text}`
    },
    {
      id: 'expand-article',
      tool: 'expander',
      title: 'Expand into Article',
      desc: 'Turn a short idea into a full article',
      build: (text) => `Expand the following short text into a full Article. Keep structure coherent and add relevant details:\n\n${text}`
    },
    {
      id: 'rewrite-casual',
      tool: 'tone',
      title: 'Rewrite — Casual',
      desc: 'Make the text casual and friendly',
      build: (text) => `Rewrite the following text in a Casual tone while retaining the original meaning. Output only the rewritten text:\n\n${text}`
    },
    {
      id: 'explain-age10',
      tool: 'explain',
      title: 'Explain for age 10',
      desc: 'Explain the content for a 10-year-old',
      build: (text) => `Explain the following content for a child (age 10). Use simple language and examples appropriate for that age:\n\n${text}`
    },
  ]

  // helper to compute suggestions: prioritize those matched by typed keywords
  const computeSuggestions = (text) => {
    if (!text || text.trim().length === 0) {
      // if no text show nothing
      return []
    }
    const t = text.toLowerCase()
    // if user explicitly typed a command early, prioritize that tool suggestions
    if (/^\s*summarize\b/.test(t)) {
      return SUGGESTIONS.filter(s => s.tool === 'summarizer')
    }
    if (/^\s*(paraphrase|rewrite)\b/.test(t)) {
      return SUGGESTIONS.filter(s => s.tool === 'paraphrase')
    }
    if (/^\s*(grammar|check|correct)\b/.test(t)) {
      return SUGGESTIONS.filter(s => s.tool === 'grammar')
    }
    if (/^\s*(expand|expand to|expand into)\b/.test(t)) {
      return SUGGESTIONS.filter(s => s.tool === 'expander')
    }
    if (/^\s*(rewrite in|tone|rewrite)\b/.test(t)) {
      return SUGGESTIONS.filter(s => s.tool === 'tone')
    }
    if (/^\s*explain\b/.test(t)) {
      return SUGGESTIONS.filter(s => s.tool === 'explain')
    }

    // otherwise return top presets and allow filtering by text content words
    const keywords = t.split(/\s+/).filter(Boolean)
    // rank suggestions by how many keywords appear in title/desc
    const ranked = SUGGESTIONS
      .map(s => {
        const hay = (s.title + ' ' + s.desc).toLowerCase()
        const score = keywords.reduce((acc, k) => acc + (hay.includes(k) ? 1 : 0), 0)
        return { s, score }
      })
      .sort((a, b) => b.score - a.score)
      .map(x => x.s)
    return ranked
  }

  // keyboard navigation handlers for suggestions
  useEffect(() => {
    const handleKey = (ev) => {
      if (!showSuggestions) return
      if (ev.key === 'ArrowDown') {
        ev.preventDefault()
        setHighlightIndex(i => Math.min(i + 1, filteredSuggestions.length - 1))
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault()
        setHighlightIndex(i => Math.max(i - 1, 0))
      } else if (ev.key === 'Enter') {
        // If suggestion highlighted, apply it instead of submitting form
        if (highlightIndex >= 0 && highlightIndex < filteredSuggestions.length) {
          ev.preventDefault()
          applySuggestion(filteredSuggestions[highlightIndex])
        }
      } else if (ev.key === 'Escape') {
        setShowSuggestions(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [showSuggestions, filteredSuggestions, highlightIndex])

  // apply suggestion: build the instruction (via build) and prepend to prompt text (strip command at start if present)
  const applySuggestion = (suggestion) => {
    if (!suggestion) return
    // if prompt starts with a command like 'summarize ...' remove that command portion
    const stripped = prompt.replace(/^\s*(summarize|paraphrase|rewrite|grammar|check|correct|expand|rewrite|tone|explain)([^\n]*)/i, '').trim()
    const baseText = stripped.length > 0 ? stripped : prompt.trim()
    const finalText = suggestion.build(baseText || prompt)
    setPrompt(finalText)
    setShowSuggestions(false)
    // focus and set caret to end
    setTimeout(() => {
      if (promptRef.current) {
        promptRef.current.focus()
        try { promptRef.current.setSelectionRange(finalText.length, finalText.length) } catch (e) {}
      }
    }, 50)
  }

  // handle prompt change: compute suggestions and show
  const handlePromptChange = (value) => {
    setPrompt(value)
    if (mode !== 'text') {
      setShowSuggestions(false)
      setFilteredSuggestions([])
      setHighlightIndex(-1)
      return
    }
    const list = computeSuggestions(value)
    if (list.length > 0) {
      setFilteredSuggestions(list)
      setShowSuggestions(true)
      setHighlightIndex(0)
    } else {
      setFilteredSuggestions([])
      setShowSuggestions(false)
      setHighlightIndex(-1)
    }
    // keep quick summarizer behavior: if prompt cleared, allow quick summarizer to reappear later
    if (value.trim().length === 0) setShowSummarizerQuick(true)
  }

  // speech recognition setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null
    if (!SpeechRecognition) {
      recognitionRef.current = null
      return
    }
    const recog = new SpeechRecognition()
    recog.continuous = false
    recog.interimResults = true
    recog.lang = document.documentElement.lang || 'en-IN'

    recog.onstart = () => {
      setListening(true)
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
        const base = committedRef.current ? committedRef.current.trim() + ' ' : ''
        const newValue = (base + finalTranscript.trim()).trim()
        setPrompt(newValue)
        committedRef.current = newValue
        // recompute suggestions
        const list = computeSuggestions(newValue)
        setFilteredSuggestions(list); setShowSuggestions(list.length>0); setHighlightIndex(0)
      } else {
        const display = (committedRef.current ? committedRef.current + ' ' : '') + interimTranscript
        setPrompt(display)
      }
    }

    recog.onerror = (err) => {
      console.warn('SpeechRecognition error:', err)
      try { recog.stop() } catch (e) {}
      setListening(false)
    }

    recog.onend = () => setListening(false)
    recognitionRef.current = recog

    return () => {
      try {
        recog.onresult = null; recog.onerror = null; recog.onend = null; recog.onstart = null; recog.stop && recog.stop()
      } catch (e) {}
      recognitionRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleMic = () => {
    const recog = recognitionRef.current
    if (!recog) {
      toast('Voice input not supported in this browser')
      return
    }
    if (listening) {
      try { recog.stop() } catch (e) { console.warn(e); setListening(false) }
    } else {
      committedRef.current = prompt || ''
      try { recog.start() } catch (err) { setTimeout(() => { try { recog.start() } catch (e) { console.warn('recog.start() failed', e) } }, 200) }
    }
  }

  // send message handler
  const onSubmit = async (e) => {
    try {
      e.preventDefault()
      if (!user) return toast('Login to send message')
      if (!selectedChat) return toast('Select a chat first')

      setLoading(true)
      const promptCopy = prompt
      setMessages(prev => [...prev, { role: 'user', content: promptCopy, timestamp: Date.now(), isImage: false }])
      setPrompt('')

      const { data } = await axios.post(
        `/api/message/${mode}`,
        { chatId: selectedChat._id, prompt: promptCopy, isPublished },
        { headers: { Authorization: token } }
      )
      if (data.success) {
        setMessages(prev => [...prev, data.reply])
        if (mode === 'image') setUser(prev => ({ ...prev, credits: prev.credits - 2 }))
        else setUser(prev => ({ ...prev, credits: prev.credits - 1 }))
      } else {
        toast.error(data.message)
        setPrompt(promptCopy)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
      setShowSuggestions(false)
      setFilteredSuggestions([])
      setHighlightIndex(-1)
    }
  }

  // load messages & autoscroll
  useEffect(() => { if (selectedChat) setMessages(selectedChat.messages || []) }, [selectedChat])
  useEffect(() => { if (containerRef.current) containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' }) }, [messages])

  // suggestion click handler
  const onSuggestionClick = (s) => {
    applySuggestion(s)
  }

  // when prompt changes externally (like speech), recompute suggestions
  useEffect(() => {
    if (mode !== 'text') return
    const list = computeSuggestions(prompt)
    setFilteredSuggestions(list)
    setShowSuggestions(list.length > 0)
    setHighlightIndex(list.length > 0 ? 0 : -1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, mode])

  return (
    <div className='flex-1 flex flex-col justify-between m-5 md:m-10 xl:mx-30 max-md:mt-14 2xl:pr-40'>
      {/* Chat messages */}
      <div ref={containerRef} className='flex-1 mb-5 overflow-y-scroll'>
        {messages.length === 0 && (
          <div className='h-full flex flex-col items-center justify-center gap-2 text-primary'>
            <img src={theme === 'dark' ? assets.logo_full : assets.logo_full_dark} className='w-full max-w-56 sm:max-w-68' alt="" />
            <p className='mt-5 text-4xl sm:text-6xl text-center text-gray-400 dark:text-white'>Ask me anything</p>
          </div>
        )}
        {messages.map((message, i) => <Message key={i} message={message} />)}
        {loading && <div className='loader flex items-center gap-1.5 '>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-white animate-bounce"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-white animate-bounce"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-500 dark:bg-white animate-bounce"></div>
        </div>}
      </div>

      {/* Tools panel placeholder (you can keep your ToolsGrid above) */}
      {/* Quick summarizer remains available below if needed (not duplicated here) */}

      {/* Suggestion box - appears above prompt when applicable */}
      {mode === 'text' && showSuggestions && filteredSuggestions.length > 0 && (
        <div className="max-w-2xl mx-auto mb-2">
          <div className="rounded-md border bg-transparent p-2 shadow-sm">
            <div className="text-xs text-gray-400 mb-2">Suggestions</div>
            <ul className="max-h-48 overflow-auto">
              {filteredSuggestions.map((s, idx) => (
                <li
                  key={s.id}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onMouseLeave={() => setHighlightIndex(-1)}
                  onClick={() => onSuggestionClick(s)}
                  className={`flex items-start gap-3 p-2 rounded cursor-pointer transition ${highlightIndex === idx ? 'bg-[#6b46c1]/20' : 'hover:bg-gray-100/30'}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{s.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.desc}</div>
                  </div>
                  <div className="text-xs text-gray-400 select-none">Apply</div>
                </li>
              ))}
            </ul>
            <div className="text-xs text-gray-400 mt-2">Use ↑↓ and Enter to select</div>
          </div>
        </div>
      )}

      {/* Prompt Input Box */}
      <form className='bg-primary/20 dark:bg-[#583C79]/30 border border-primary dark:border-[#80609F]/30 rounded-full w-full max-w-2xl p-3 pl-4 mx-auto flex gap-4 items-center' onSubmit={onSubmit}>
        <select onChange={(e) => setMode(e.target.value)} value={mode} className='text-sm pl-3 pr-2 outline-none' >
          <option value="text" className=' dark:bg-purple-900'>Text</option>
          <option value="image" className=' dark:bg-purple-900'>Image</option>
        </select>

        <input
          ref={promptRef}
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          type="text"
          placeholder=" Type your prompt here..."
          className="flex-1 w-full text-sm outline-none"
          required
        />

        {/* Mic Button */}
        <button
          type="button"
          onClick={toggleMic}
          className={`p-2 rounded-full transition-colors mr-1 ${listening ? 'bg-red-500 text-white' : 'bg-transparent'}`}
          title={listening ? 'Stop listening' : 'Start voice input'}
        >
          {assets.mic_icon ? <img src={assets.mic_icon} alt="mic" className="w-5 h-5" /> : <span style={{ fontSize: 18 }}>{listening ? '⏹' : '🎤'}</span>}
        </button>

        <button className="" disabled={loading} type="submit">
          <img src={loading ? assets.stop_icon : assets.send_icon} className='w-8 cursor-pointer' alt="" />
        </button>
      </form>
    </div>
  )
}

export default ChatBox
