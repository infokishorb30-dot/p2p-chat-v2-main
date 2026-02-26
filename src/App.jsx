import { useState, useEffect, useRef } from 'react'
import Peer from 'peerjs'
import './App.css'

function App() {
  // Connection State
  const [myId, setMyId] = useState('')
  const [peerId, setPeerId] = useState('')
  const [conn, setConn] = useState(null)

  // UI State
  const [screen, setScreen] = useState('setup') // 'setup' | 'connect' | 'chat'
  const [status, setStatus] = useState('')
  const [errorObj, setErrorObj] = useState(null) // { message: string }

  // Data State
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [customIdObj, setCustomIdObj] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  const peerRef = useRef(null)

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
        setErrorObj({ message: 'Network error. Check your internet connection.' })
        setStatus('Network error')
      } else if (err.type === 'webrtc') {
        setErrorObj({ message: 'WebRTC error. Try disabling VPN or proxy if using one.' })
        setStatus('WebRTC error')
      } else {
        setErrorObj({ message: `Error: ${err.type}. Try reconnecting.` })
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
    })

    connection.on('data', (data) => {
      setMessages(prev => [...prev, { sender: 'peer', text: data, timestamp: Date.now() }])
    })

    connection.on('error', (err) => {
      console.error('Connection error:', err)
      setErrorObj({ message: 'Connection lost. Please reconnect.' })
      setStatus('Connection error')
    })

    connection.on('close', () => {
      setStatus('Peer disconnected')
      setConn(null)
      setScreen('connect')
      alert('Chat ended by peer.')
    })
  }

  const disconnectChat = () => {
    if (conn) conn.close()
    setConn(null)
    setScreen('connect')
    setMessages([])
  }

  // -- Messaging --
  const sendMessage = (e) => {
    e.preventDefault()
    if (!conn || !inputValue.trim()) return

    conn.send(inputValue)
    setMessages((prev) => [...prev, { sender: 'me', text: inputValue, timestamp: Date.now() }])
    setInputValue('')
  }

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
    if (peerRef.current) peerRef.current.destroy()
    setMyId('')
    setScreen('setup')
    setStatus('')
    setErrorObj(null)
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
        {status}
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
          <span className="connection-status">● Connected</span>
        </div>
      </header>

      <div className="messages-list">
        {messages.length === 0 && <div className="empty-state">Say hello! 👋</div>}
        {messages.map((msg, index) => (
          <div key={index} className={`message-bubble ${msg.sender}`}>
            <div className="message-content">{msg.text}</div>
            <div className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>

      <form className="message-input" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          autoFocus
        />
        <button type="submit" disabled={!inputValue.trim()}>Send</button>
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
