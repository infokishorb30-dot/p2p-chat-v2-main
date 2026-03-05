import { useState, useEffect, useRef } from 'react'
import Peer from 'peerjs'
import './App.css'

function App() {
  // Connection State
  const [myId, setMyId] = useState('')
  const [peerId, setPeerId] = useState('')
  const [conn, setConn] = useState(null)
  const renderChatScreen = () => (
    <div className="screen chat-screen two-panel-layout">
      {/* Center/Right Panel: Chat Window (scrollable) */}
      <div className="chat-window-panel" style={{overflowY: 'auto', flex: 1, minHeight: 0}}>
        {/* Template Messaging Dropdown */}
        <div style={{padding: '8px 16px', background: 'rgba(0,0,0,0.08)', borderBottom: '1px solid var(--glass-border)'}}>
          <select
            style={{padding: '6px 12px', borderRadius: '8px', fontSize: '1rem'}}
            defaultValue=""
            onChange={e => {
              if (e.target.value) sendMessage({ preventDefault: () => {}, customText: e.target.value })
              e.target.value = ''
            }}
          >
            <option value="" disabled>Send a template message...</option>
            <option value="Hello! How can I help you today?">Hello! How can I help you today?</option>
            <option value="Thank you for reaching out. We'll get back to you soon.">Thank you for reaching out. We'll get back to you soon.</option>
            <option value="Your request has been received and is being processed.">Your request has been received and is being processed.</option>
          </select>
        </div>
        <ChatWindow
          messages={messages.map(msg => {
            // Example: Add interactive buttons and list messages for demonstration
            if (msg.text === '__demo_list__') {
              return {
                id: msg.timestamp + '-' + msg.sender,
                sender: 'other',
                type: 'list',
                title: 'Choose an option',
                options: [
                  { id: 'opt1', label: 'Order Status' },
                  { id: 'opt2', label: 'Talk to Agent' },
                  { id: 'opt3', label: 'FAQ' }
                ],
                onSelect: (option) => sendMessage({ preventDefault: () => {}, customText: `Selected: ${option.label}` }),
              }
            }
            if (msg.text === '__demo_buttons__') {
              return {
                id: msg.timestamp + '-' + msg.sender,
                sender: 'other',
                type: 'buttons',
                text: 'Quick actions:',
                buttons: [
                  { id: 'b1', label: '👍 Yes', onClick: () => sendMessage({ preventDefault: () => {}, customText: '👍 Yes' }) },
                  { id: 'b2', label: '👎 No', onClick: () => sendMessage({ preventDefault: () => {}, customText: '👎 No' }) }
                ]
              }
            }
            return {
              id: msg.timestamp + '-' + msg.sender,
              text: msg.text,
              sender: msg.sender === 'me' ? 'user' : 'other',
              timestamp: msg.timestamp,
              status: msg.queued ? 'pending' : 'sent',
            }
          })}
          onSendMessage={text => sendMessage({ preventDefault: () => {}, customText: text })}
          userId="me"
          inputPlaceholder="Type a message..."
          style={{height: '100%'}}
        />
      </div>
      {/* Right Panel: CRM Details */}
      <div className="crm-panel" style={{flex: '0 0 320px', background: 'rgba(0,0,0,0.12)', borderLeft: '1px solid var(--glass-border)', padding: '24px', display: 'flex', flexDirection: 'column', minWidth: '250px'}}>
        <h3 style={{marginTop: 0}}>Customer Details</h3>
        <div style={{color: '#94a3b8', fontSize: '0.95rem'}}>
          {/* Example CRM info, replace with real data as needed */}
          {selectedChat ? (
            <>
              <div><b>Name:</b> {selectedChat}</div>
              <div><b>Email:</b> {selectedChat}@example.com</div>
              <div><b>Status:</b> Active</div>
              <div><b>Last Seen:</b> {new Date().toLocaleString()}</div>
            </>
          ) : (
            <p>No customer selected.</p>
          )}
        </div>
      </div>
    </div>
  )
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
      // Modified sendMessage to support both form submit and direct text input
      const sendMessage = (e) => {
        let text = inputValue
        if (e && e.customText !== undefined) {
          text = e.customText
        } else if (e && e.target) {
          e.preventDefault()
        }
        if (!text.trim() || text.length > MAX_MESSAGE_LENGTH) return

        if (!conn || !conn.open) {
          messageQueueRef.current.push(text)
          setMessages((prev) => [...prev, { 
            sender: 'me', 
            text, 
            timestamp: Date.now(), 
            queued: true 
          }])
          setInputValue('')
          setErrorObj({ message: '⏳ Message queued. Will send when connection is restored.' })
          return
        }

        try {
          if (conn.bufferedAmount && conn.bufferedAmount > 65536) {
            messageQueueRef.current.push(text)
            setMessages((prev) => [...prev, { 
              sender: 'me', 
              text, 
              timestamp: Date.now(), 
              queued: true 
            }])
            setInputValue('')
            setErrorObj({ message: '⏳ Optimizing delivery... will retry when ready.' })
            return
          }
          conn.send(text)
          setMessages((prev) => [...prev, { sender: 'me', text, timestamp: Date.now() }])
          setInputValue('')
          setErrorObj(null)
        } catch (err) {
          console.error('Error sending message:', err)
          messageQueueRef.current.push(text)
          setErrorObj({ message: '⏳ Message queued due to connection issue. Will retry automatically.' })
        }
      }
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

  // WhatsApp-like three-panel layout
  return (
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
      {/* Center Panel: Chat Window */}
      <div className="chat-window-panel">
        {/* ...existing code for chat window and input (to be replaced with advanced-chat-kai) ... */}
        <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#94a3b8'}}>
          <p>Chat UI will appear here (advanced-chat-kai integration coming next).</p>
        </div>
      </div>
      {/* Right Panel: CRM Details */}
      <div className="crm-panel" style={{flex: '0 0 320px', background: 'rgba(0,0,0,0.12)', borderLeft: '1px solid var(--glass-border)', padding: '24px', display: 'flex', flexDirection: 'column', minWidth: '250px'}}>
        <h3 style={{marginTop: 0}}>Customer Details</h3>
        <div style={{color: '#94a3b8', fontSize: '0.95rem'}}>
          {/* Example CRM info, replace with real data as needed */}
          {selectedChat ? (
            <>
              <div><b>Name:</b> {selectedChat}</div>
              <div><b>Email:</b> {selectedChat}@example.com</div>
              <div><b>Status:</b> Active</div>
              <div><b>Last Seen:</b> {new Date().toLocaleString()}</div>
            </>
          ) : (
            <p>No customer selected.</p>
          )}
        </div>
      </div>
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
