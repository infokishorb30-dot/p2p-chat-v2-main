import { useState, useEffect, useRef } from 'react'
import Peer from 'peerjs'
import './App.css'

function App() {
  // Connection State
  const [myId, setMyId] = useState('')
  const [peerId, setPeerId] = useState('')
  const [conn, setConn] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // UI State
  const [screen, setScreen] = useState('setup') // 'setup' | 'connect' | 'chat'
  const [status, setStatus] = useState('')
  const [errorObj, setErrorObj] = useState(null) // { message: string }

  // Data State
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [customIdObj, setCustomIdObj] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  // Refs for connection management
  const peerRef = useRef(null)
  const messagesListRef = useRef(null)
  const messageQueueRef = useRef([]) // Queue for messages sent while disconnected
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttemptsRef = useRef(5)

  // Character limit constant
  const MAX_MESSAGE_LENGTH = 2000

  // -- PeerJS Initialization --
  const initializePeer = (idToUse = null) => {
    if (peerRef.current) peerRef.current.destroy()
    setErrorObj(null)

    const peerConfig = {
      config: {
        iceServers: [
          // STUN Servers - Distributed globally for reliable NAT traversal
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { urls: 'stun:stun.stunprotocol.org:3478' },
          { urls: 'stun:stun.ekiga.net:3478' },
          { urls: 'stun:stun.ideasip.com:3478' },
          { urls: 'stun:stun.schlund.de:3478' },
          { urls: 'stun:stun.xten.com:3478' },
          // TURN Server - Fallback relay for networks blocking direct P2P
          { 
            urls: 'turn:numb.viagenie.ca',
            username: 'webrtc@live.com',
            credential: 'webrtc'
          }
        ],
        sdpTransform: (sdp) => sdp
      }
    }
    const peer = idToUse ? new Peer(idToUse, peerConfig) : new Peer(peerConfig)
    setStatus('Connecting to server...')

    peer.on('open', (id) => {
      setMyId(id)
      setScreen('connect')
      setStatus('Online')
      peerRef.current = peer
    })

    peer.on('connection', (connection) => {
      handleIncomingConnection(connection)
    })

    peer.on('error', (err) => {
      console.error(err)
      if (err.type === 'peer-unavailable') {
        setErrorObj({ message: `Peer "${peerId}" not found. Ensure they're online and have shared their ID.` })
        setStatus('Peer unavailable')
      } else if (err.type === 'unavailable-id') {
        setErrorObj({ message: `ID "${idToUse}" is already taken. Choose a different name.` })
        setStatus('Registration failed')
      } else if (err.type === 'network') {
        setErrorObj({ message: 'Network error. Check your internet connection and device settings.' })
        setStatus('Network error')
      } else if (err.type === 'webrtc') {
        setErrorObj({ message: 'WebRTC error. Try disabling VPN/proxy or switching networks.' })
        setStatus('WebRTC error')
      } else if (err.type === 'disconnected') {
        setErrorObj({ message: 'Connection lost. Will attempt to reconnect automatically.' })
        setStatus('Attempting reconnection')
        if (screen === 'chat') {
          attemptReconnect()
        }
      } else {
        setErrorObj({ message: `Connection error: ${err.type}. Please try again.` })
        setStatus('Error occurred')
      }
    })

    peer.on('disconnected', () => {
      setStatus('Disconnected. Reconnecting...')
      peer.reconnect()
    })
  }

  // Auto-init specific effects
  useEffect(() => {
    // Optional: We could auto-init a random ID here, 
    // but user requested "Set ID" screen first.
    // So we do nothing until they submit the form.
    return () => {
      if (peerRef.current) peerRef.current.destroy()
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesListRef.current) {
      const scrollHeight = messagesListRef.current.scrollHeight
      messagesListRef.current.scrollTop = scrollHeight
    }
  }, [messages])

  // Handle page visibility and network connectivity
  useEffect(() => {
    // Handle online/offline events
    const handleOnline = () => {
      setIsOnline(true)
      if (screen === 'chat' && conn && !conn.open) {
        setStatus('Reconnecting...')
        attemptReconnect()
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setStatus('Offline - waiting for connection')
      setErrorObj({ message: 'Network disconnected. Will reconnect automatically.' })
    }

    // Handle page visibility (screen lock or window minimized)
    // Note: WebRTC connections may be suspended but we keep our state
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - maintain connection, don't forcefully reconnect
        console.log('Page hidden - keeping connection alive')
        // Connection will persist if still open
      } else {
        // Page is visible again - check connection health
        console.log('Page visible - verifying connection')
        if (isOnline && screen === 'chat' && conn) {
          // Small delay to let event queue settle
          setTimeout(() => {
            if (!conn.open && conn !== null) {
              setStatus('Reconnecting...')
              attemptReconnect()
            }
          }, 500)
        }
      }
    }

    // Keep-alive for WebRTC connection during page suspension
    const keepAliveInterval = setInterval(() => {
      if (screen === 'chat' && conn && conn.open && isOnline && !document.hidden) {
        // Connection is fine
      } else if (screen === 'chat' && conn && !conn.open && isOnline && !document.hidden) {
        // Try to restore if disconnected
        attemptReconnect()
      }
    }, 5000) // Check every 5 seconds

    // Handle page unload/close
    const handleBeforeUnload = () => {
      if (conn && conn.open) {
        conn.close()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(keepAliveInterval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
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
    if (!peerId || !peerRef.current) return
    setStatus(`Connecting to ${peerId}...`)
    setErrorObj(null)

    const connection = peerRef.current.connect(peerId, {
      reliable: true,
      iceTransportPolicy: 'all' // Allow both direct and relay connections
    })
    setConn(connection)
    setupConnectionListeners(connection)

    // Extended timeout for global connectivity
    setTimeout(() => {
      if (!connection.open) {
        setStatus('Connection timed out. Retrying might help.')
        setErrorObj({ message: 'Connection timeout. Try again or check peer is online.' })
      }
    }, 15000)
  }

  const setupConnectionListeners = (connection) => {
    connection.on('open', () => {
      setScreen('chat')
      setStatus(`Connected to ${connection.peer}`)
      setErrorObj(null)
      reconnectAttemptsRef.current = 0 // Reset reconnect counter

      // Send any queued messages
      while (messageQueueRef.current.length > 0) {
        const queuedMsg = messageQueueRef.current.shift()
        try {
          connection.send(queuedMsg)
        } catch (err) {
          console.error('Failed to send queued message:', err)
          messageQueueRef.current.unshift(queuedMsg) // Put back if failed
          break
        }
      }
    })

    connection.on('data', (data) => {
      setMessages(prev => [...prev, { sender: 'peer', text: data, timestamp: Date.now() }])
    })

    connection.on('error', (err) => {
      console.error('Connection error:', err)
      setErrorObj({ message: 'Connection error. Attempting to reconnect...' })
      setStatus('Connection error')
      attemptReconnect()
    })

    connection.on('close', () => {
      setStatus('Peer disconnected')
      setConn(null)
      setScreen('connect')
      setErrorObj({ message: 'Peer disconnected. Ready to connect to another peer.' })
      messageQueueRef.current = [] // Clear queue on disconnect
    })
  }

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    if (reconnectAttemptsRef.current >= maxReconnectAttemptsRef.current) {
      setErrorObj({ message: 'Reconnection failed. Please try connecting again manually.' })
      setStatus('Reconnection failed')
      return
    }

    reconnectAttemptsRef.current += 1
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    const delayMs = Math.pow(2, reconnectAttemptsRef.current) * 1000
    
    setStatus(`Reconnecting in ${Math.round(delayMs / 1000)}s... (Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttemptsRef.current})`)

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isOnline) {
        setStatus('Waiting for network connection...')
        return
      }

      if (conn && peerId && peerRef.current) {
        const newConnection = peerRef.current.connect(peerId, {
          reliable: true,
          iceTransportPolicy: 'all'
        })
        setConn(newConnection)
        setupConnectionListeners(newConnection)

        // Timeout for this reconnection attempt
        setTimeout(() => {
          if (!newConnection.open && reconnectAttemptsRef.current < maxReconnectAttemptsRef.current) {
            attemptReconnect()
          }
        }, 15000)
      }
    }, delayMs)
  }

  const disconnectChat = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (conn) conn.close()
    setConn(null)
    setScreen('connect')
    setMessages([])
    messageQueueRef.current = []
    reconnectAttemptsRef.current = 0
    setStatus('Ready to connect')
    setErrorObj(null)
  }

  // -- Messaging --
  const sendMessage = (e) => {
    e.preventDefault()
    if (!inputValue.trim() || inputValue.length > MAX_MESSAGE_LENGTH) return

    if (!conn || !conn.open) {
      // Queue message if not connected
      messageQueueRef.current.push(inputValue)
      setMessages((prev) => [...prev, { 
        sender: 'me', 
        text: inputValue, 
        timestamp: Date.now(), 
        queued: true 
      }])
      setInputValue('')
      setErrorObj({ message: '⏳ Message queued. Will send when connection is restored.' })
      return
    }

    // Send message if connected
    try {
      conn.send(inputValue)
      setMessages((prev) => [...prev, { sender: 'me', text: inputValue, timestamp: Date.now() }])
      setInputValue('')
      setErrorObj(null)
    } catch (err) {
      console.error('Error sending message:', err)
      messageQueueRef.current.push(inputValue)
      setErrorObj({ message: '⏳ Message queued due to connection issue. Will retry automatically.' })
    }
  }

  // Calculate character count and percentage
  const charCount = inputValue.length
  const charPercentage = (charCount / MAX_MESSAGE_LENGTH) * 100
  const isNearLimit = charPercentage > 80

  // -- UI Helpers --
  const copyId = () => {
    navigator.clipboard.writeText(myId)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleSetId = (e) => {
    e.preventDefault()
    if (customIdObj.trim()) initializePeer(customIdObj.trim())
    // else initializePeer() // Generate random if empty? Or force user?
    // Let's force user to pick a name for better UX as requested
  }

  const resetId = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (peerRef.current) peerRef.current.destroy()
    setMyId('')
    setScreen('setup')
    setStatus('')
    setErrorObj(null)
    setMessages([])
    messageQueueRef.current = []
    reconnectAttemptsRef.current = 0
  }

  // -- Render Screens --

  const renderSetupScreen = () => (
    <div className="screen setup-screen">
      <h2>Welcome!</h2>
      <p>Choose a display name to start.</p>
      <form onSubmit={handleSetId} className="setup-form">
        <input
          type="text"
          placeholder="e.g. Alice"
          value={customIdObj}
          onChange={e => setCustomIdObj(e.target.value)}
          className="large-input"
          autoFocus
        />
        <button type="submit" className="large-btn">Start Chatting</button>
      </form>
      {errorObj && <div className="error-banner">{errorObj.message}</div>}
    </div>
  )

  const renderConnectScreen = () => (
    <div className="screen connect-screen">
      <div className="dashboard-card">
        <span className="label">Your ID</span>
        <div className="id-row">
          <div className="big-id" onClick={copyId}>
            {myId}
            {isCopied && <span className="copy-tooltip">Copied!</span>}
          </div>
          <button className="text-btn" onClick={resetId}>Change</button>
        </div>
      </div>

      <div className="divider">
        <span>Connect with a friend</span>
      </div>

      <div className="connect-form">
        <input
          type="text"
          placeholder="Friend's Name (ID)"
          value={peerId}
          onChange={e => setPeerId(e.target.value)}
        />
        <button onClick={connectToPeer} disabled={!peerId}>Connect</button>
      </div>

      <div className="status-bar">
        <div>{status} {!isOnline && '📡'}</div>
        {errorObj && <span className="error-inline"> - {errorObj.message}</span>}
      </div>
    </div>
  )

  const renderChatScreen = () => (
    <div className="screen chat-screen">
      <header className="chat-header">
        <button onClick={disconnectChat} className="back-btn">← Back</button>
        <div className="header-info">
          <span className="peer-name">{conn?.peer || 'Unknown'}</span>
          <span className={`connection-status ${conn?.open ? 'connected' : 'disconnected'}`}>
            {conn?.open ? '● Connected' : '● Disconnected'}
          </span>
          {!isOnline && <span className="network-status">📡 Offline</span>}
        </div>
      </header>

      <div className="messages-list" ref={messagesListRef}>
        {messages.length === 0 && <div className="empty-state">Say hello! 👋</div>}
        {messages.map((msg, index) => (
          <div key={index} className={`message-bubble ${msg.sender} ${msg.queued ? 'queued' : ''}`}>
            <div className="message-content">{msg.text}</div>
            {msg.queued && <div className="queued-indicator">⏳ Queued</div>}
            <div className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>

      <form className="message-input" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Type a message... (max 2000 characters)"
          value={inputValue}
          onChange={(e) => {
            const newValue = e.target.value.slice(0, MAX_MESSAGE_LENGTH)
            setInputValue(newValue)
          }}
          autoFocus
          maxLength={MAX_MESSAGE_LENGTH}
        />
        <div className="input-meta">
          <span className={`char-count ${isNearLimit ? 'warning' : ''}`}>
            {charCount}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>
        <button type="submit" disabled={!inputValue.trim() || charCount === 0}>➤</button>
      </form>
    </div>
  )

  return (
    <div className="app-container">
      <div className={`glass-panel ${screen}`}>
        {screen === 'setup' && renderSetupScreen()}
        {screen === 'connect' && renderConnectScreen()}
        {screen === 'chat' && renderChatScreen()}
      </div>
    </div>
  )
}

export default App
