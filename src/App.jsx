import { useState, useEffect, useRef } from 'react'
import Peer from 'peerjs'
import './App.css'

const MAX_MESSAGE_LENGTH = 500
const EMOJIS = ['😄','😂','❤️','👍','🎉','🔥','😢','😮','🙏','👏','😍','🤔','✅','👋','🤝','💯']

function App() {
  // -- State --
  const [myId, setMyId] = useState('')
  const [peerId, setPeerId] = useState('')
  const [conn, setConn] = useState(null)
  const [screen, setScreen] = useState('setup')
  const [status, setStatus] = useState('')
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [errorObj, setErrorObj] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isCopied, setIsCopied] = useState(false)
  const [customIdObj, setCustomIdObj] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  // -- Refs --
  const peerRef = useRef(null)
  const messageQueueRef = useRef([])
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttemptsRef = useRef(5)
  const reconnectTimeoutRef = useRef(null)
  const connectTimeoutRef = useRef(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // -- Peer Initialization --
  const initializePeer = (customId) => {
    if (peerRef.current) peerRef.current.destroy()
    setStatus('Initializing...')

    const peer = new Peer(customId)
    peerRef.current = peer

    peer.on('open', (id) => {
      setMyId(id)
      setScreen('connect')
      setStatus('Ready to connect')
    })

    peer.on('connection', handleIncomingConnection)

    peer.on('error', (err) => {
      console.error('Peer error:', err)
      if (err.type === 'unavailable-id') {
        setErrorObj({ message: 'That name is already taken. Please choose another.' })
        setStatus('')
        return
      }
      if (err.type === 'peer-unavailable') {
        setErrorObj({ message: 'Peer not found. Check the ID and try again.' })
        setIsConnecting(false)
        return
      }
      if (err.type === 'disconnected') {
        setErrorObj({ message: 'Connection lost. Attempting to reconnect...' })
        if (screen === 'chat') attemptReconnect()
        return
      }
      setErrorObj({ message: `Error: ${err.type}. Please try again.` })
      setIsConnecting(false)
    })
  }

  // -- Queue Retry --
  useEffect(() => {
    if (!conn) return
    const retryInterval = setInterval(() => {
      if (!conn.open || messageQueueRef.current.length === 0) return
      const queuedMsg = messageQueueRef.current[0]
      try {
        conn.send(queuedMsg)
        messageQueueRef.current.shift()
        setMessages((prev) => {
          const updated = [...prev]
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].text === queuedMsg && updated[i].queued) {
              updated[i] = { ...updated[i], queued: false }
              break
            }
          }
          return updated
        })
        setErrorObj(null)
      } catch (err) {
        console.error('Failed to send queued:', err)
      }
    }, 500)
    return () => clearInterval(retryInterval)
  }, [conn])

  // -- Network Events --
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (screen === 'chat' && conn && !conn.open) attemptReconnect()
    }
    const handleOffline = () => {
      setIsOnline(false)
      setErrorObj({ message: 'No internet connection.' })
    }
    const handleBeforeUnload = () => { if (conn?.open) conn.close() }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [screen, conn, isOnline])

  // -- Connection Handlers --
  const handleIncomingConnection = (connection) => {
    setConn(connection)
    setStatus('Incoming connection...')
    setupConnectionListeners(connection)
  }

  const connectToPeer = () => {
    if (!peerId.trim() || !peerRef.current) return
    setIsConnecting(true)
    setStatus(`Connecting to ${peerId}...`)
    setErrorObj(null)
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current)

    const connection = peerRef.current.connect(peerId.trim(), { reliable: true })
    setConn(connection)
    setupConnectionListeners(connection)

    connectTimeoutRef.current = setTimeout(() => {
      if (!connection.open) {
        setStatus('Connection timed out.')
        setErrorObj({ message: 'Connection timed out. Check the ID and try again.' })
        setIsConnecting(false)
      }
      connectTimeoutRef.current = null
    }, 30000)
  }

  const setupConnectionListeners = (connection) => {
    connection.on('open', () => {
      if (connectTimeoutRef.current) { clearTimeout(connectTimeoutRef.current); connectTimeoutRef.current = null }
      setScreen('chat')
      setStatus(`Connected`)
      setErrorObj(null)
      setIsConnecting(false)
      reconnectAttemptsRef.current = 0
      // Flush queue
      while (messageQueueRef.current.length > 0) {
        const msg = messageQueueRef.current.shift()
        try { connection.send(msg) } catch { messageQueueRef.current.unshift(msg); break }
      }
    })
    connection.on('data', (data) => {
      setMessages(prev => [...prev, { sender: 'peer', text: data, timestamp: Date.now() }])
    })
    connection.on('error', (err) => {
      console.error('Connection error:', err)
      setErrorObj({ message: 'Connection error. Retrying...' })
      attemptReconnect()
    })
    connection.on('close', () => {
      setStatus('Peer disconnected')
      setConn(null)
      setScreen('connect')
      setErrorObj({ message: 'Peer disconnected.' })
      setIsConnecting(false)
      messageQueueRef.current = []
    })
  }

  const attemptReconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    if (reconnectAttemptsRef.current >= maxReconnectAttemptsRef.current) {
      setErrorObj({ message: 'Reconnection failed. Try connecting manually.' })
      return
    }
    reconnectAttemptsRef.current++
    const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isOnline || !conn || !peerId || !peerRef.current) return
      const newConn = peerRef.current.connect(peerId, { reliable: true })
      setConn(newConn)
      setupConnectionListeners(newConn)
    }, delay)
  }

  const disconnectChat = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current)
    if (conn) conn.close()
    setConn(null)
    setScreen('connect')
    setMessages([])
    messageQueueRef.current = []
    reconnectAttemptsRef.current = 0
    setStatus('Ready to connect')
    setErrorObj(null)
    setIsConnecting(false)
  }

  // -- Messaging --
  const sendMessage = (e, customText) => {
    if (e?.preventDefault) e.preventDefault()
    const text = customText || inputValue
    if (!text.trim() || text.length > MAX_MESSAGE_LENGTH) return

    if (!conn || !conn.open) {
      messageQueueRef.current.push(text)
      setMessages(prev => [...prev, { sender: 'me', text, timestamp: Date.now(), queued: true }])
      setInputValue('')
      setErrorObj({ message: '⏳ Message queued.' })
      return
    }
    try {
      conn.send(text)
      setMessages(prev => [...prev, { sender: 'me', text, timestamp: Date.now() }])
      setInputValue('')
      setErrorObj(null)
    } catch (err) {
      messageQueueRef.current.push(text)
      setErrorObj({ message: '⏳ Message queued due to error.' })
    }
    setShowEmojiPicker(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) sendMessage(e)
  }

  // -- Helpers --
  const copyId = () => {
    navigator.clipboard.writeText(myId)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSetId = (e) => {
    e.preventDefault()
    if (customIdObj.trim()) initializePeer(customIdObj.trim())
  }

  const resetId = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    if (peerRef.current) peerRef.current.destroy()
    setMyId(''); setScreen('setup'); setStatus(''); setErrorObj(null)
    setMessages([]); messageQueueRef.current = []; reconnectAttemptsRef.current = 0
    setCustomIdObj('')
  }

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const charCount = inputValue.length
  const isNearLimit = charCount / MAX_MESSAGE_LENGTH > 0.8

  // ─── SCREENS ────────────────────────────────────────────────

  const renderSetupScreen = () => (
    <div className="wa-setup-screen">
      <div className="wa-setup-card">
        {/* WhatsApp-style icon */}
        <div className="wa-setup-icon">
          <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" width="56" height="56">
            <circle cx="30" cy="30" r="30" fill="#25D366"/>
            <path d="M30 12C20.06 12 12 20.06 12 30c0 3.19.86 6.19 2.38 8.77L12 48l9.5-2.35A17.93 17.93 0 0030 48c9.94 0 18-8.06 18-18S39.94 12 30 12zm9.18 24.82c-.38 1.08-2.24 2.08-3.06 2.14-.83.06-1.62.36-5.44-1.12-4.6-1.78-7.56-6.44-7.78-6.74-.22-.3-1.8-2.4-1.8-4.58s1.14-3.24 1.56-3.68c.38-.4.84-.5 1.12-.5.28 0 .56 0 .8.02.26.02.62-.1.96.74.38.9 1.28 3.12 1.4 3.34.12.22.2.5.04.8-.16.3-.24.5-.48.76-.24.28-.5.62-.72.84-.24.24-.48.5-.2.98.28.48 1.24 2.04 2.66 3.3 1.82 1.62 3.36 2.12 3.84 2.36.48.24.76.2 1.04-.12.28-.34 1.2-1.4 1.52-1.88.32-.48.64-.4 1.08-.24.44.16 2.8 1.32 3.28 1.56.48.24.8.36.92.56.12.2.12 1.14-.26 2.22z" fill="white"/>
          </svg>
        </div>
        <h1 className="wa-setup-title">P2P Chat</h1>
        <p className="wa-setup-sub">Choose a display name to start chatting</p>
        <form onSubmit={handleSetId} className="wa-setup-form">
          <div className="wa-input-group">
            <input
              type="text"
              placeholder="Your name (e.g. Alice)"
              value={customIdObj}
              onChange={e => setCustomIdObj(e.target.value)}
              className="wa-text-input"
              autoFocus
              maxLength={30}
            />
          </div>
          <button type="submit" className="wa-primary-btn" disabled={!customIdObj.trim()}>
            Start chatting
          </button>
        </form>
        {errorObj && <div className="wa-error-msg">{errorObj.message}</div>}
        <div className="wa-setup-footer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          End-to-end encrypted via WebRTC
        </div>
      </div>
    </div>
  )

  const renderConnectScreen = () => (
    <div className="wa-connect-screen">
      {/* Left sidebar column */}
      <div className="wa-connect-sidebar">
        <div className="wa-connect-header">
          <div className="wa-avatar wa-avatar-lg">
            {myId[0]?.toUpperCase()}
          </div>
          <div className="wa-connect-header-actions">
            <button className="wa-icon-btn" onClick={resetId} title="Change name">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
        </div>

        <div className="wa-search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input type="text" placeholder="Search or start new chat" className="wa-search-input" readOnly />
        </div>

        <div className="wa-connect-your-id">
          <div className="wa-your-id-label">Your P2P ID</div>
          <div className="wa-your-id-row" onClick={copyId} title="Click to copy">
            <span className="wa-your-id-value">{myId}</span>
            <button className="wa-copy-btn">
              {isCopied
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00A884" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              }
            </button>
          </div>
          {isCopied && <span className="wa-copied-toast">Copied!</span>}
          <div className="wa-your-id-hint">Share this ID with a friend to connect</div>
        </div>

        <div className="wa-connect-status-row">
          <span className={`wa-status-dot ${isOnline ? 'online' : 'offline'}`}></span>
          <span className="wa-status-text">{status} {!isOnline && '(Offline)'}</span>
        </div>
        {errorObj && <div className="wa-error-msg wa-error-msg--sm">{errorObj.message}</div>}
      </div>

      {/* Right panel: connect form */}
      <div className="wa-connect-main">
        <div className="wa-welcome-panel">
          <div className="wa-welcome-icon">
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="120" height="120">
              <circle cx="60" cy="60" r="60" fill="#E9EDEF"/>
              <path d="M60 28C42.33 28 28 42.33 28 60c0 5.72 1.54 11.1 4.26 15.72L28 92l16.72-4.24A31.87 31.87 0 0060 92c17.67 0 32-14.33 32-32S77.67 28 60 28z" fill="#C9CDD0"/>
            </svg>
          </div>
          <h2 className="wa-welcome-title">Connect with a friend</h2>
          <p className="wa-welcome-desc">Enter your friend's P2P ID below to start a private, encrypted conversation.</p>
          <div className="wa-peer-connect-form">
            <input
              type="text"
              placeholder="Friend's name / ID"
              value={peerId}
              onChange={e => setPeerId(e.target.value)}
              className="wa-text-input"
              onKeyDown={e => e.key === 'Enter' && connectToPeer()}
            />
            <button
              className="wa-primary-btn"
              onClick={connectToPeer}
              disabled={!peerId.trim() || isConnecting}
            >
              {isConnecting
                ? <span className="wa-connecting-dots"><span/><span/><span/></span>
                : 'Connect'
              }
            </button>
          </div>
          <div className="wa-e2e-note">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            End-to-end encrypted
          </div>
        </div>
      </div>
    </div>
  )

  const renderChatScreen = () => (
    <div className="wa-chat-screen">
      {/* Chat Header */}
      <div className="wa-chat-header">
        <div className="wa-chat-avatar">
          {peerId[0]?.toUpperCase()}
        </div>
        <div className="wa-chat-header-info">
          <div className="wa-chat-peer-name">{peerId}</div>
          <div className={`wa-chat-peer-status ${conn?.open ? 'online' : 'offline'}`}>
            {conn?.open ? 'Online' : status}
          </div>
        </div>
        <div className="wa-chat-header-actions">
          <button className="wa-icon-btn" title="Disconnect" onClick={disconnectChat}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="wa-messages-area" onClick={() => setShowEmojiPicker(false)}>
        {messages.length === 0 && (
          <div className="wa-no-messages">
            <div className="wa-no-messages-badge">🔒 Messages are end-to-end encrypted</div>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender === 'me'
          return (
            <div key={i} className={`wa-message-row ${isMe ? 'me' : 'peer'}`}>
              <div className={`wa-bubble ${isMe ? 'wa-bubble--me' : 'wa-bubble--peer'} ${msg.queued ? 'wa-bubble--queued' : ''}`}>
                <p className="wa-bubble-text">{msg.text}</p>
                <div className="wa-bubble-meta">
                  <span className="wa-bubble-time">{formatTime(msg.timestamp)}</span>
                  {isMe && (
                    <span className="wa-bubble-status">
                      {msg.queued
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#53BDEB" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/><polyline points="20 6 9 17 4 12" transform="translate(-4 0)"/></svg>
                      }
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Error Banner */}
      {errorObj && (
        <div className="wa-chat-error">{errorObj.message}</div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="wa-emoji-tray">
          {EMOJIS.map(emoji => (
            <button key={emoji} className="wa-emoji-btn" onClick={() => { sendMessage(null, emoji) }}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="wa-input-bar">
        <button
          className={`wa-icon-btn wa-emoji-toggle ${showEmojiPicker ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(v => !v) }}
          title="Emoji"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>

        <div className="wa-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_LENGTH}
            className="wa-message-input"
          />
          {isNearLimit && (
            <span className="wa-char-count" style={{ color: charCount >= MAX_MESSAGE_LENGTH ? '#ef4444' : '#f59e0b' }}>
              {charCount}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>

        <button
          className="wa-send-btn"
          onClick={sendMessage}
          disabled={!inputValue.trim()}
          title="Send"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  )

  return (
    <div className="wa-app">
      {screen === 'setup' && renderSetupScreen()}
      {screen === 'connect' && renderConnectScreen()}
      {screen === 'chat' && renderChatScreen()}
    </div>
  )
}

export default App
