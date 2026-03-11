import { useState, useEffect, useRef } from 'react'
import Peer from 'peerjs'
import './App.css'


function App() {
  // --- Connection State ---
  const [myId, setMyId] = useState('');
  const [peerId, setPeerId] = useState('');
  const [conn, setConn] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // --- UI State ---
  const [screen, setScreen] = useState('setup');
  const [status, setStatus] = useState('');
  const [errorObj, setErrorObj] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // --- Data State ---
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [customIdObj, setCustomIdObj] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [chatList, setChatList] = useState([]);

  // --- Refs ---
  const peerRef = useRef(null);
  const messagesListRef = useRef(null);
  const messageQueueRef = useRef([]);
  const reconnectTimeoutRef = useRef(null);
  const connectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttemptsRef = useRef(5);

  // --- Constants ---
  const MAX_MESSAGE_LENGTH = 2000;

  // --- Modern Layout ---
  const renderModernChatScreen = () => (
    <div className="h-screen w-screen flex items-center justify-center bg-[#111B21] overflow-hidden">
      <div className="w-full h-full md:w-[95vw] md:h-[95vh] md:max-w-6xl md:rounded-xl overflow-hidden flex shadow-2xl">
        {/* Sidebar */}
        <div className="flex flex-col bg-white border-r border-gray-200 w-full md:w-[340px] shrink-0">
          <div className="bg-[#F0F2F5] px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-[#111B21] text-lg">Chats</span>
            <button className="rounded-full bg-[#00A884] text-white px-3 py-1" onClick={() => setScreen('connect')}>New</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {chatList.length === 0 ? (
              <div className="text-gray-400 text-center mt-10">No recent chats</div>
            ) : (
              chatList.map(chat => (
                <div
                  key={chat.id}
                  className={`px-4 py-3 cursor-pointer hover:bg-[#E9EDEF] ${selectedChat === chat.id ? 'bg-[#E9EDEF]' : ''}`}
                  onClick={() => selectChat(chat.id)}
                >
                  <div className="font-medium text-[#111B21]">{chat.name}</div>
                  <div className="text-xs text-[#8696A0]">{chat.lastMessage || 'No messages'}</div>
                </div>
              ))
            )}
          </div>
        </div>
        {/* Chat Window */}
        <div className="flex-1 flex flex-col bg-[#F0F2F5]">
          {selectedChat || conn?.open ? (
            <>
              <div className="bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#111B21]">{conn?.peer || 'Select a chat'}</span>
                  <span className={`ml-2 text-xs ${conn?.open ? 'text-[#25D366]' : 'text-gray-400'}`}>{conn?.open ? 'Online' : 'Offline'}</span>
                </div>
                <button className="text-[#00A884]" onClick={disconnectChat}>Disconnect</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6" ref={messagesListRef}>
                {messages.length === 0 && <div className="text-gray-400 text-center mt-10">Say hello! 👋</div>}
                {messages.map((msg, idx) => (
                  <div key={idx} className={`mb-2 flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <span className={`inline-block px-3 py-2 rounded-lg ${msg.sender === 'me' ? 'bg-[#DCF8C6]' : 'bg-white'}`}>{msg.text}</span>
                  </div>
                ))}
              </div>
              <form className="bg-white px-4 py-3 border-t border-gray-200 flex items-center" onSubmit={sendMessage}>
                <input
                  className="flex-1 border rounded-full px-4 py-2 mr-2"
                  placeholder="Type a message..."
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <button className="bg-[#00A884] text-white px-4 py-2 rounded-full" type="submit" disabled={!inputValue.trim()}>Send</button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-32 h-32 rounded-full bg-[#E9EDEF] flex items-center justify-center mb-6">
                <span role="img" aria-label="chat" style={{ fontSize: 64, color: '#C9CDD0' }}>💬</span>
              </div>
              <h2 className="text-[#41525D] mb-2">Welcome to P2P Chat</h2>
              <p className="text-[#8696A0] text-sm mb-4">Select a chat or connect with a friend to start messaging.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // -- Theme Management --
  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.style.colorScheme = 'dark'
      document.body.classList.add('dark-mode')
      document.body.classList.remove('light-mode')
    } else {
      root.style.colorScheme = 'light'
      document.body.classList.add('light-mode')
      document.body.classList.remove('dark-mode')
    }
  }, [darkMode])

  // -- PeerJS Initialization --
  const initializePeer = (idToUse = null) => {
    if (peerRef.current) peerRef.current.destroy()
    setErrorObj(null)

    const peerConfig = {
      config: {
        iceServers: [
          // STUN Servers - Reliable, globally distributed
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          // TURN Servers - Relay fallback for restrictive/symmetric NATs
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turns:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceTransportPolicy: 'all' // Allow both direct and relay connections
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

  // Auto-retry queued messages when connection recovers
  useEffect(() => {
    if (!conn || !conn.open || messageQueueRef.current.length === 0) return

    const retryInterval = setInterval(() => {
      // Check connection and queue status - use optional chaining for safety
      if (!conn?.open || messageQueueRef.current.length === 0) return
      
      // Check buffer is not too full
      if (conn.bufferedAmount && conn.bufferedAmount > 65536) return

      const queuedMsg = messageQueueRef.current.shift()
      try {
        conn.send(queuedMsg)
        // Update UI to remove queued status
        setMessages((prev) => {
          const updated = [...prev]
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].text === queuedMsg && updated[i].queued) {
              updated[i].queued = false
              break
            }
          }
          return updated
        })
        setErrorObj(null)
      } catch (err) {
        console.error('Failed to send queued message:', err)
        messageQueueRef.current.unshift(queuedMsg)
      }
    }, 500)

    return () => clearInterval(retryInterval)
  }, [conn])

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

    // Clear any previous connection timeout
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }

    const connection = peerRef.current.connect(peerId, {
      reliable: true
    })
    setConn(connection)
    setupConnectionListeners(connection)

    // Extended timeout for global connectivity (30s to allow TURN negotiation)
    connectTimeoutRef.current = setTimeout(() => {
      if (!connection.open) {
        setStatus('Connection timed out. Retrying might help.')
        setErrorObj({ message: 'Connection timeout. Try again or check peer is online.' })
      }
      connectTimeoutRef.current = null
    }, 30000)
  }

  const setupConnectionListeners = (connection) => {
    connection.on('open', () => {
      // Cancel connection timeout on successful open
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }
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
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
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
      // Check WebRTC data channel buffer to prevent congestion
      // If buffer is full, queue message and let the auto-retry effect handle it
      if (conn.bufferedAmount && conn.bufferedAmount > 65536) {
        messageQueueRef.current.push(inputValue)
        setMessages((prev) => [...prev, { 
          sender: 'me', 
          text: inputValue, 
          timestamp: Date.now(), 
          queued: true 
        }])
        setInputValue('')
        setErrorObj({ message: '⏳ Optimizing delivery... will retry when ready.' })
        return
      }
      
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
  const insertEmoji = (emoji) => {
    setInputValue(prev => prev + emoji)
    setShowEmojiPicker(false)
  }

  const addToRecentChats = (contactId, contactName) => {
    setChatList(prev => {
      const existing = prev.find(chat => chat.id === contactId)
      if (existing) {
        return [{ ...existing, lastMessage: inputValue, timestamp: Date.now() }, ...prev.filter(chat => chat.id !== contactId)]
      }
      return [{ id: contactId, name: contactName, lastMessage: inputValue, timestamp: Date.now(), unread: 0 }, ...prev]
    })
  }

  const selectChat = (chatId) => {
    const chat = chatList.find(c => c.id === chatId)
    if (chat) {
      setSelectedChat(chatId)
      setPeerId(chatId)
      // Load messages for this chat (in production, would fetch from DB)
      setMessages([])
      setInputValue('')
    }
  }

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
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
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
    <div className="screen chat-screen whatsapp-layout">
      {/* Left Panel: Chat List */}
      <div className="chat-list-panel">
        <div className="chat-list-header">
          <h2>Chats</h2>
          <button 
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="chat-search">
          <input 
            type="text" 
            placeholder="🔍 Search or start new chat"
            className="search-input"
          />
        </div>

        <div className="chat-list">
          {chatList.length === 0 ? (
            <div className="empty-chats">
              <p>No recent chats</p>
              <p className="small">Connect with friends to start chatting</p>
            </div>
          ) : (
            chatList.map(chat => (
              <div 
                key={chat.id}
                className={`chat-item ${selectedChat === chat.id ? 'active' : ''}`}
                onClick={() => selectChat(chat.id)}
              >
                <div className="chat-avatar">{chat.name[0]?.toUpperCase()}</div>
                <div className="chat-info">
                  <div className="chat-name">{chat.name}</div>
                  <div className="chat-preview">{chat.lastMessage || 'No messages'}</div>
                </div>
                <div className="chat-meta">
                  <div className="chat-time">
                    {new Date(chat.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {chat.unread > 0 && <div className="unread-badge">{chat.unread}</div>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Chat Window */}
      <div className="chat-window-panel">
        {selectedChat || conn?.open ? (
          <>
            <header className="chat-header">
              <div className="header-left">
                <button onClick={disconnectChat} className="back-btn">← Back</button>
                <div className="header-info">
                  <span className="peer-name">{conn?.peer || 'Select a chat'}</span>
                  <span className={`connection-status ${conn?.open ? 'connected' : 'disconnected'}`}>
                    {conn?.open ? '● Connected' : '● Disconnected'}
                  </span>
                </div>
              </div>
              {!isOnline && <span className="network-status">📡 Offline</span>}
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
              <div className="input-toolbar">
                <button 
                  type="button"
                  className="toolbar-btn"
                  title="Attachments"
                  onClick={(e) => { e.preventDefault() }}
                >
                  📎
                </button>
                <button 
                  type="button"
                  className="toolbar-btn"
                  title="Emoji"
                  onClick={(e) => { 
                    e.preventDefault()
                    setShowEmojiPicker(!showEmojiPicker)
                  }}
                >
                  😊
                </button>
              </div>

              {showEmojiPicker && (
                <div className="emoji-picker">
                  {['😊', '😂', '🤔', '😍', '👍', '🎉', '🔥', '💯', '👏', '🙏', '❤️', '💔'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-btn"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <div className="input-row">
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
              </div>
            </form>
          </>
        ) : (
          <div className="empty-chat-window">
            <div className="select-chat-prompt">
              <div className="whatsapp-icon">💬</div>
              <h3>Select a chat to start messaging</h3>
              <p>Choose a contact from the list or enter a friend's ID to connect</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Use modern layout for chat screen, fallback to original for setup/connect
  if (screen === 'chat') {
    return renderModernChatScreen();
  }
  return (
    <div className="app-container">
      <div className={`glass-panel ${screen}`}> 
        {screen === 'setup' && renderSetupScreen()}
        {screen === 'connect' && renderConnectScreen()}
      </div>
    </div>
  );
}

export default App
