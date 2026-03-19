import { useState, useEffect, useRef, useCallback } from 'react'
import Peer from 'peerjs'
import './App.css'

// ─────────────────────────────────────────────────────────────
// THEME DEFINITIONS
// Each theme writes CSS custom-properties onto <html>.
// Every style in the app reads those vars, so themes apply
// consistently across sidebar, chat panel, inputs, bubbles, etc.
// ─────────────────────────────────────────────────────────────
const ACCENT_COLORS = {
  green:  { label:'Green',  hex:'#25D366', dark:'#128C7E', rgb:'37,211,102'  },
  blue:   { label:'Blue',   hex:'#2196F3', dark:'#1565C0', rgb:'33,150,243'  },
  purple: { label:'Purple', hex:'#9C27B0', dark:'#6A1B9A', rgb:'156,39,176'  },
  orange: { label:'Orange', hex:'#FF6B35', dark:'#E64A00', rgb:'255,107,53'  },
  pink:   { label:'Pink',   hex:'#E91E8C', dark:'#AD1457', rgb:'233,30,140'  },
  teal:   { label:'Teal',   hex:'#00BCD4', dark:'#00838F', rgb:'0,188,212'   },
}

const buildTokens = (mode, accentKey) => {
  const acc = ACCENT_COLORS[accentKey] || ACCENT_COLORS.green
  if (mode === 'light') return {
    '--bg-page':         'linear-gradient(135deg,#e8f5e9 0%,#e3f2fd 100%)',
    '--bg-sidebar':      '#f5f5f5',
    '--bg-sidebar-hd':   '#eeeeee',
    '--bg-chat':         '#fafafa',
    '--bg-messages':     '#f0f0f0',
    '--bg-input-bar':    '#eeeeee',
    '--bg-bubble-me':    acc.hex,
    '--bg-bubble-peer':  '#ffffff',
    '--bg-item-active':  '#e0e0e0',
    '--bg-input':        '#ffffff',
    '--bg-card':         'rgba(255,255,255,0.88)',
    '--bg-card-inner':   'rgba(0,0,0,0.04)',
    '--border':          'rgba(0,0,0,0.1)',
    '--border-card':     'rgba(0,0,0,0.12)',
    '--text-primary':    '#111111',
    '--text-secondary':  '#444444',
    '--text-muted':      '#888888',
    '--text-bubble-me':  '#ffffff',
    '--text-bubble-peer':'#111111',
    '--text-timestamp':  'rgba(0,0,0,0.4)',
    '--accent':          acc.hex,
    '--accent-dark':     acc.dark,
    '--accent-rgb':      acc.rgb,
    '--online-dot':      '#4caf50',
    '--offline-dot':     '#9e9e9e',
    '--shadow':          '0 2px 12px rgba(0,0,0,0.1)',
    '--shadow-card':     '0 8px 40px rgba(0,0,0,0.14)',
    '--dot-border':      '2.5px solid #f5f5f5',
  }
  return {
    '--bg-page':         'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)',
    '--bg-sidebar':      '#111B21',
    '--bg-sidebar-hd':   '#1F2C34',
    '--bg-chat':         '#111B21',
    '--bg-messages':     '#0B141A',
    '--bg-input-bar':    '#1F2C34',
    '--bg-bubble-me':    '#005C4B',
    '--bg-bubble-peer':  '#1F2C34',
    '--bg-item-active':  '#2A3942',
    '--bg-input':        '#2A3942',
    '--bg-card':         'rgba(255,255,255,0.08)',
    '--bg-card-inner':   'rgba(255,255,255,0.05)',
    '--border':          'rgba(255,255,255,0.07)',
    '--border-card':     'rgba(255,255,255,0.12)',
    '--text-primary':    '#ffffff',
    '--text-secondary':  'rgba(255,255,255,0.6)',
    '--text-muted':      'rgba(255,255,255,0.3)',
    '--text-bubble-me':  '#ffffff',
    '--text-bubble-peer':'#ffffff',
    '--text-timestamp':  'rgba(255,255,255,0.28)',
    '--accent':          acc.hex,
    '--accent-dark':     acc.dark,
    '--accent-rgb':      acc.rgb,
    '--online-dot':      acc.hex,
    '--offline-dot':     '#6b7280',
    '--shadow':          '0 2px 12px rgba(0,0,0,0.35)',
    '--shadow-card':     '0 20px 60px rgba(0,0,0,0.4)',
    '--dot-border':      '2.5px solid #111B21',
  }
}

const applyTheme = (mode, accent) => {
  const tokens = buildTokens(mode, accent)
  const root = document.documentElement
  Object.entries(tokens).forEach(([k,v]) => root.style.setProperty(k,v))
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const sessionKey = (a, b) => [a, b].sort().join('::')

// Style shorthand tokens — read CSS vars at render time
const T = {
  bgPage:        { background:'var(--bg-page)' },
  bgSidebar:     { background:'var(--bg-sidebar)' },
  bgSidebarHd:   { background:'var(--bg-sidebar-hd)' },
  bgMessages:    { background:'var(--bg-messages)' },
  bgInputBar:    { background:'var(--bg-input-bar)' },
  bgInput:       { background:'var(--bg-input)', color:'var(--text-primary)' },
  bgCard:        { background:'var(--bg-card)' },
  bgCardInner:   { background:'var(--bg-card-inner)' },
  textPrimary:   { color:'var(--text-primary)' },
  textSecondary: { color:'var(--text-secondary)' },
  textMuted:     { color:'var(--text-muted)' },
  accent:        { color:'var(--accent)' },
}

// ─────────────────────────────────────────────────────────────
// THEME PANEL  (slide-in drawer)
// ─────────────────────────────────────────────────────────────
function ThemePanel({ mode, accent, onMode, onAccent, onClose }) {
  return (
    <div style={{
      position:'fixed',top:0,right:0,bottom:0,width:270,zIndex:2000,
      background:'var(--bg-sidebar-hd)',
      borderLeft:'1px solid var(--border)',
      boxShadow:'-6px 0 30px rgba(0,0,0,0.3)',
      display:'flex',flexDirection:'column',
    }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'16px 18px',borderBottom:'1px solid var(--border)'}}>
        <span style={{...T.textPrimary,fontWeight:700,fontSize:15}}>🎨 Appearance</span>
        <button onClick={onClose} style={{background:'none',border:'none',
          color:'var(--text-muted)',cursor:'pointer',fontSize:22,lineHeight:1}}>×</button>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'22px 18px',display:'flex',flexDirection:'column',gap:26}}>

        {/* Mode */}
        <div>
          <p style={{...T.textMuted,fontSize:11,textTransform:'uppercase',
            letterSpacing:'0.09em',margin:'0 0 12px'}}>Mode</p>
          <div style={{display:'flex',gap:8}}>
            {[{id:'dark',icon:'🌙',label:'Dark'},{id:'light',icon:'☀️',label:'Light'}].map(m=>(
              <button key={m.id} onClick={()=>onMode(m.id)} style={{
                flex:1,padding:'12px 8px',borderRadius:14,cursor:'pointer',
                border: mode===m.id ? '2px solid var(--accent)' : '2px solid var(--border)',
                background: mode===m.id ? `rgba(var(--accent-rgb),0.12)` : 'var(--bg-card-inner)',
                color: mode===m.id ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: mode===m.id ? 700 : 400,
                fontSize:13,display:'flex',flexDirection:'column',alignItems:'center',gap:5,
                transition:'all 0.15s',
              }}>
                <span style={{fontSize:22}}>{m.icon}</span>{m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accent colour */}
        <div>
          <p style={{...T.textMuted,fontSize:11,textTransform:'uppercase',
            letterSpacing:'0.09em',margin:'0 0 12px'}}>Accent Colour</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {Object.entries(ACCENT_COLORS).map(([key,val])=>(
              <button key={key} onClick={()=>onAccent(key)} style={{
                padding:'12px 6px',borderRadius:14,cursor:'pointer',
                border: accent===key ? `2px solid ${val.hex}` : '2px solid var(--border)',
                background: accent===key ? `rgba(${val.rgb},0.14)` : 'var(--bg-card-inner)',
                display:'flex',flexDirection:'column',alignItems:'center',gap:7,
                transition:'all 0.15s',
              }}>
                <span style={{
                  width:30,height:30,borderRadius:'50%',display:'block',
                  background:`linear-gradient(135deg,${val.hex},${val.dark})`,
                  boxShadow: accent===key ? `0 0 0 3px rgba(${val.rgb},0.35)` : 'none',
                  transition:'box-shadow 0.15s',
                }}/>
                <span style={{
                  fontSize:11,fontWeight:accent===key?700:400,
                  color: accent===key ? val.hex : 'var(--text-secondary)',
                }}>{val.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p style={{...T.textMuted,fontSize:11,textTransform:'uppercase',
            letterSpacing:'0.09em',margin:'0 0 12px'}}>Preview</p>
          <div style={{borderRadius:16,overflow:'hidden',border:'1px solid var(--border)'}}>
            <div style={{...T.bgSidebarHd,padding:'10px 12px',borderBottom:'1px solid var(--border)',
              display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:26,height:26,borderRadius:'50%',background:'var(--accent)',
                display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:11}}>A</div>
              <div>
                <div style={{...T.textPrimary,fontSize:11,fontWeight:600}}>Alice</div>
                <div style={{...T.textMuted,fontSize:10}}>alice-id</div>
              </div>
            </div>
            <div style={{...T.bgMessages,padding:'10px',display:'flex',flexDirection:'column',gap:6}}>
              <div style={{display:'flex',justifyContent:'flex-start'}}>
                <span style={{background:'var(--bg-bubble-peer)',color:'var(--text-bubble-peer)',
                  padding:'6px 10px',borderRadius:'10px 10px 10px 3px',fontSize:11}}>Hey! 👋</span>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end'}}>
                <span style={{background:'var(--bg-bubble-me)',color:'var(--text-bubble-me)',
                  padding:'6px 10px',borderRadius:'10px 10px 3px 10px',fontSize:11}}>Hello!</span>
              </div>
            </div>
            <div style={{...T.bgInputBar,padding:'7px 10px',display:'flex',gap:6,alignItems:'center',
              borderTop:'1px solid var(--border)'}}>
              <div style={{...T.bgInput,flex:1,borderRadius:12,padding:'5px 10px',
                fontSize:10,border:'1px solid var(--border)',...T.textMuted}}>Type…</div>
              <div style={{width:22,height:22,borderRadius:'50%',background:'var(--accent)',
                display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:10}}>➤</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────
function App() {

  // ── Theme ──────────────────────────────────────────────────
  const [themeMode,      setThemeMode]      = useState('dark')
  const [themeAccent,    setThemeAccent]    = useState('green')
  const [showThemePanel, setShowThemePanel] = useState(false)

  useEffect(() => { applyTheme(themeMode, themeAccent) }, [themeMode, themeAccent])

  const changeMode   = m => { setThemeMode(m);   applyTheme(m, themeAccent) }
  const changeAccent = a => { setThemeAccent(a); applyTheme(themeMode, a)   }

  // ── Mobile detection ───────────────────────────────────────
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640)
  // 'sidebar' | 'chat'  — which panel is visible on mobile
  const [mobilePanelView, setMobilePanelView] = useState('sidebar')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── User profile ───────────────────────────────────────────
  const [nameInput,  setNameInput]  = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [setupStep,  setSetupStep]  = useState('name')
  const [userName,   setUserName]   = useState('')
  const [userPhone,  setUserPhone]  = useState('')  // eslint-disable-line

  // ── PeerJS ─────────────────────────────────────────────────
  const [myId,     setMyId]     = useState('')
  const [peerId,   setPeerId]   = useState('')
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // ── UI ─────────────────────────────────────────────────────
  const [screen,       setScreen]       = useState('setup')
  const [status,       setStatus]       = useState('')
  const [errorMsg,     setErrorMsg]     = useState('')
  const [selectedPeer, setSelectedPeer] = useState(null)

  // ── Data ───────────────────────────────────────────────────
  const [contacts,    setContacts]    = useState({})
  const [sessions,    setSessions]    = useState({})
  const [connections, setConnections] = useState({})
  const [inputValue,  setInputValue]  = useState('')
  const [isCopied,    setIsCopied]    = useState(false)

  // ── Refs ───────────────────────────────────────────────────
  const peerRef           = useRef(null)
  const messagesEndRef    = useRef(null)
  const connectionsRef    = useRef({})
  const myIdRef           = useRef('')
  const reconnectTimers   = useRef({})
  const reconnectAttempts = useRef({})

  const MAX_MSG_LEN   = 2000
  const MAX_RECONNECT = 5

  useEffect(() => { connectionsRef.current = connections }, [connections])
  useEffect(() => { myIdRef.current = myId }, [myId])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [sessions, selectedPeer])

  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => { setIsOnline(false); setErrorMsg('Network offline.') }
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => () => { peerRef.current?.destroy() }, [])

  // ── Core helpers ───────────────────────────────────────────
  const addMessage = useCallback((fromPeer, toPeer, msgObj) => {
    const key = sessionKey(fromPeer, toPeer)
    setSessions(prev => ({...prev, [key]:[...(prev[key]||[]), msgObj]}))
  }, [])

  const upsertContact = useCallback((pid, patch={}) => {
    setContacts(prev => ({
      ...prev,
      [pid]: {name:pid,online:false,lastMsg:'',lastTs:Date.now(),unread:0,...(prev[pid]||{}),...patch}
    }))
  }, [])

  // ── PeerJS init ────────────────────────────────────────────
  const initializePeer = useCallback((id) => {
    peerRef.current?.destroy(); setErrorMsg('')
    const cfg = {config:{iceServers:[
      {urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},
      {urls:'stun:global.stun.twilio.com:3478'},
      {urls:'turn:openrelay.metered.ca:80', username:'openrelayproject',credential:'openrelayproject'},
      {urls:'turn:openrelay.metered.ca:443',username:'openrelayproject',credential:'openrelayproject'},
    ],iceTransportPolicy:'all'}}
    const peer = id ? new Peer(id, cfg) : new Peer(cfg)
    setStatus('Connecting to server…')
    peer.on('open', pid => { setMyId(pid); myIdRef.current=pid; setScreen('connect'); setStatus('Online'); peerRef.current=peer })
    peer.on('connection', conn => wireConnection(conn))
    peer.on('error', err => {
      if (err.type==='unavailable-id') { setErrorMsg(`"${id}" is taken.`); setScreen('setup'); setSetupStep('name') }
      else if (err.type==='peer-unavailable') setErrorMsg('Peer not found. Make sure they are online.')
      else setErrorMsg(`Error: ${err.type}`)
    })
    peer.on('disconnected', () => { setStatus('Reconnecting…'); peer.reconnect() })
  }, []) // eslint-disable-line

  // ── Wire connection ────────────────────────────────────────
  const wireConnection = useCallback((conn) => {
    const pid = conn.peer
    setConnections(prev => ({...prev,[pid]:conn}))
    upsertContact(pid, {online:false})
    conn.on('open', () => {
      upsertContact(pid, {online:true})
      setConnections(prev => ({...prev,[pid]:conn}))
      reconnectAttempts.current[pid]=0
      setStatus(`Connected to ${pid}`); setErrorMsg('')
      setScreen('chat'); setSelectedPeer(pid)
    })
    conn.on('data', text => {
      const me = myIdRef.current
      addMessage(pid, me, {sender:'peer',senderId:pid,text,timestamp:Date.now()})
      setContacts(prev => ({...prev,[pid]:{...prev[pid],lastMsg:text,lastTs:Date.now(),
        unread:prev[pid]?.viewingNow?0:(prev[pid]?.unread||0)+1}}))
    })
    conn.on('close', () => {
      upsertContact(pid, {online:false})
      setConnections(prev => {const n={...prev};delete n[pid];return n})
      setStatus(`${pid} disconnected`); setErrorMsg(`${pid} disconnected. History preserved.`)
      scheduleReconnect(pid)
    })
    conn.on('error', () => scheduleReconnect(pid))
  }, [addMessage, upsertContact]) // eslint-disable-line

  // ── Actions ────────────────────────────────────────────────
  const connectToPeer = useCallback((targetId) => {
    const target = (targetId||peerId).trim()
    if (!target || !peerRef.current) return
    setStatus(`Connecting to ${target}…`); setErrorMsg('')
    wireConnection(peerRef.current.connect(target, {reliable:true}))
  }, [peerId, wireConnection])

  const scheduleReconnect = useCallback((pid) => {
    if ((reconnectAttempts.current[pid]||0) >= MAX_RECONNECT) return
    reconnectAttempts.current[pid]=(reconnectAttempts.current[pid]||0)+1
    const delay = Math.pow(2, reconnectAttempts.current[pid])*1000
    clearTimeout(reconnectTimers.current[pid])
    reconnectTimers.current[pid] = setTimeout(() => {
      if (!isOnline||!peerRef.current) return
      wireConnection(peerRef.current.connect(pid, {reliable:true}))
    }, delay)
  }, [isOnline, wireConnection])

  const openChat = useCallback((pid) => {
    setSelectedPeer(pid); setScreen('chat'); setInputValue(''); setErrorMsg('')
    setMobilePanelView('chat')  // on mobile: switch to chat panel
    setContacts(prev => ({...prev,[pid]:{...(prev[pid]||{}),viewingNow:true,unread:0}}))
  }, [])

  useEffect(() => {
    return () => {
      if (selectedPeer)
        setContacts(prev => ({...prev,[selectedPeer]:{...(prev[selectedPeer]||{}),viewingNow:false}}))
    }
  }, [selectedPeer])

  const sendMessage = e => {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text||text.length>MAX_MSG_LEN||!selectedPeer) return
    const msg = {sender:'me',senderId:myId,text,timestamp:Date.now()}
    addMessage(myId, selectedPeer, msg)
    upsertContact(selectedPeer, {lastMsg:text,lastTs:Date.now()})
    setInputValue('')
    const c = connectionsRef.current[selectedPeer]
    if (c?.open) { try { c.send(text) } catch(e){console.error(e)} }
    else setErrorMsg('⏳ Peer offline — message saved locally.')
  }

  const closeChat = () => {
    connectionsRef.current[selectedPeer]?.close()
    setConnections(prev => {const n={...prev};delete n[selectedPeer];return n})
    upsertContact(selectedPeer, {online:false}); setSelectedPeer(null)
  }

  const resetApp = () => {
    peerRef.current?.destroy()
    Object.values(reconnectTimers.current).forEach(clearTimeout)
    setMyId('');setScreen('setup');setSetupStep('name');setStatus('');setErrorMsg('');setInputValue('')
    setUserName('');setUserPhone('');setNameInput('');setPhoneInput('')
    setSelectedPeer(null);setContacts({});setSessions({});setConnections({})
  }

  const copyId = () => { navigator.clipboard.writeText(myId); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000) }

  // ── Derived ────────────────────────────────────────────────
  const activeMessages = selectedPeer ? (sessions[sessionKey(myId, selectedPeer)]||[]) : []
  const activeContact  = selectedPeer ? contacts[selectedPeer] : null
  const isPeerOnline   = !!(activeContact?.online && connectionsRef.current[selectedPeer]?.open)
  const sortedContacts = Object.entries(contacts).sort(([,a],[,b])=>(b.lastTs||0)-(a.lastTs||0))

  // Shared style helpers (all read CSS vars)
  const card   = {...T.bgCard, backdropFilter:'blur(20px)', border:'1px solid var(--border-card)', borderRadius:24, padding:36, width:'100%', maxWidth:380, boxShadow:'var(--shadow-card)', position:'relative'}
  const lbl    = {...T.textMuted, fontSize:11, textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:6}
  const inp    = {width:'100%', padding:'12px 16px', borderRadius:14, ...T.bgInput, border:'1px solid var(--border)', fontSize:15, outline:'none', boxSizing:'border-box'}
  const btn    = {padding:'13px', borderRadius:14, background:'var(--accent)', color:'#fff', fontWeight:700, fontSize:15, border:'none', cursor:'pointer'}
  const errBox = {marginTop:14, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:12, padding:'10px 14px', color:'#fca5a5', fontSize:13}

  // Theme toggle button — reused everywhere
  const ThemeBtn = () => (
    <button onClick={() => setShowThemePanel(p=>!p)} title="Change theme"
      style={{background:'none', border:'1px solid var(--border)', color:'var(--text-secondary)',
        borderRadius:10, padding:'4px 8px', fontSize:16, cursor:'pointer', lineHeight:1,
        background: showThemePanel ? 'rgba(var(--accent-rgb),0.12)' : 'none',
      }}>🎨</button>
  )

  // ══════════════════════════════════════════════════════════
  // RENDER: SETUP
  // ══════════════════════════════════════════════════════════
  if (screen==='setup') return (
    <div style={{minHeight:'100vh',width:'100vw',display:'flex',alignItems:'center',justifyContent:'center',...T.bgPage}}>
      {showThemePanel && <ThemePanel mode={themeMode} accent={themeAccent} onMode={changeMode} onAccent={changeAccent} onClose={()=>setShowThemePanel(false)}/>}
      <div style={card}>
        <div style={{position:'absolute',top:16,right:16}}><ThemeBtn/></div>
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',fontSize:32,boxShadow:`0 4px 20px rgba(var(--accent-rgb),0.4)`}}>💬</div>
          <h1 style={{...T.textPrimary,fontSize:24,fontWeight:700,margin:'0 0 4px'}}>P2P Chat</h1>
          <p style={{...T.textMuted,fontSize:13,margin:0}}>Secure peer-to-peer messaging</p>
        </div>
        {setupStep==='name' ? (
          <form onSubmit={e=>{e.preventDefault();if(nameInput.trim()){setUserName(nameInput.trim());setSetupStep('phone')}}} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div><label style={lbl}>Your Name</label>
              <input autoFocus type="text" placeholder="e.g. Alice" value={nameInput} onChange={e=>setNameInput(e.target.value)} style={inp}/></div>
            <button type="submit" disabled={!nameInput.trim()} style={{...btn,opacity:nameInput.trim()?1:0.4}}>Continue →</button>
          </form>
        ):(
          <form onSubmit={e=>{e.preventDefault();if(phoneInput.replace(/\D/g,'').length>=7){setUserPhone(phoneInput.trim());initializePeer(nameInput.trim())}}} style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <button type="button" onClick={()=>setSetupStep('name')} style={{background:'none',border:'none',...T.textMuted,cursor:'pointer',fontSize:13}}>← Back</button>
              <span style={{...T.textSecondary,fontSize:13}}>Hi, <strong style={T.textPrimary}>{nameInput}</strong>!</span>
            </div>
            <div><label style={lbl}>Phone Number</label>
              <input autoFocus type="tel" placeholder="+91 98765 43210" value={phoneInput} onChange={e=>setPhoneInput(e.target.value)} style={inp}/>
              <p style={{...T.textMuted,fontSize:11,margin:'6px 0 0'}}>Used as your contact info</p></div>
            <button type="submit" disabled={phoneInput.replace(/\D/g,'').length<7} style={{...btn,opacity:phoneInput.replace(/\D/g,'').length>=7?1:0.4}}>Start Chatting</button>
          </form>
        )}
        {errorMsg && <div style={errBox}>{errorMsg}</div>}
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════
  // RENDER: CONNECT
  // ══════════════════════════════════════════════════════════
  if (screen==='connect') return (
    <div style={{minHeight:'100vh',width:'100vw',display:'flex',alignItems:'center',justifyContent:'center',...T.bgPage}}>
      {showThemePanel && <ThemePanel mode={themeMode} accent={themeAccent} onMode={changeMode} onAccent={changeAccent} onClose={()=>setShowThemePanel(false)}/>}
      <div style={{...card,maxWidth:420}}>
        <div style={{position:'absolute',top:16,right:16}}><ThemeBtn/></div>

        {/* Profile */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',...T.bgCardInner,borderRadius:16,border:'1px solid var(--border)',marginBottom:24}}>
          <div style={{width:40,height:40,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#fff',fontSize:18}}>
            {userName[0]?.toUpperCase()}
          </div>
          <div style={{flex:1}}>
            <div style={{...T.textPrimary,fontWeight:600,fontSize:15}}>{userName}</div>
            <div style={{...T.textMuted,fontSize:12}}>{userPhone}</div>
          </div>
          <button onClick={resetApp} style={{background:'none',border:'none',...T.textMuted,cursor:'pointer',fontSize:12}}>Change</button>
        </div>

        {/* My ID */}
        <label style={lbl}>Your Chat ID</label>
        <div onClick={copyId} style={{display:'flex',alignItems:'center',gap:10,...T.bgCardInner,border:'1px solid var(--border)',borderRadius:14,padding:'12px 16px',cursor:'pointer',marginBottom:20}}>
          <span style={{...T.textPrimary,fontFamily:'monospace',fontSize:14,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{myId||'Connecting…'}</span>
          <span style={{...T.accent,fontSize:12,fontWeight:600}}>{isCopied?'✓ Copied!':'Copy'}</span>
        </div>

        {/* Connect */}
        <label style={lbl}>Connect with a friend</label>
        <div style={{display:'flex',gap:8,marginBottom:16}}>
          <input type="text" placeholder="Friend's Chat ID" value={peerId} onChange={e=>setPeerId(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&connectToPeer()} style={{...inp,margin:0,flex:1}}/>
          <button onClick={()=>connectToPeer()} disabled={!peerId.trim()} style={{...btn,margin:0,padding:'0 20px',opacity:peerId.trim()?1:0.4}}>Go</button>
        </div>

        <div style={{...T.textMuted,fontSize:12,textAlign:'center',marginBottom:8}}>{status} {!isOnline&&'📡 Offline'}</div>
        {errorMsg && <div style={errBox}>{errorMsg}</div>}

        {/* Recent chats */}
        {sortedContacts.length>0 && (
          <div style={{marginTop:20}}>
            <div style={{...T.textMuted,fontSize:11,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Recent Chats</div>
            {sortedContacts.map(([pid,c]) => {
              const msgCount=(sessions[sessionKey(myId,pid)]||[]).length
              return (
                <div key={pid} onClick={()=>openChat(pid)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'10px 12px',borderRadius:14,...T.bgCardInner,cursor:'pointer',marginBottom:6,border:'1px solid var(--border)'}}>
                  <div style={{position:'relative',flexShrink:0}}>
                    <div style={{width:36,height:36,borderRadius:'50%',background:`rgba(var(--accent-rgb),0.2)`,display:'flex',alignItems:'center',justifyContent:'center',...T.textPrimary,fontWeight:700,fontSize:15}}>
                      {pid[0]?.toUpperCase()}
                    </div>
                    <span style={{position:'absolute',bottom:0,right:0,width:11,height:11,borderRadius:'50%',background:c.online?'var(--online-dot)':'var(--offline-dot)',border:'2px solid var(--bg-card)'}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{...T.textPrimary,fontSize:14,fontWeight:500}}>{pid}</div>
                    <div style={{color:c.online?'var(--online-dot)':'var(--text-muted)',fontSize:11}}>{c.online?'● Online':'● Offline'} · {msgCount} msg{msgCount!==1?'s':''}</div>
                  </div>
                  {c.unread>0 && <span style={{background:'var(--accent)',color:'#fff',borderRadius:99,padding:'2px 7px',fontSize:11,fontWeight:700}}>{c.unread}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════
  // RENDER: CHAT
  // ══════════════════════════════════════════════════════════

  // On mobile we show either the sidebar OR the chat panel, never both.
  // On desktop they sit side-by-side in a flex row.
  const showSidebar = !isMobile || mobilePanelView === 'sidebar'
  const showChat    = !isMobile || mobilePanelView === 'chat'

  return (
    <div style={{height:'100vh',width:'100vw',display:'flex',overflow:'hidden',...T.bgSidebar,flexDirection:'row'}}>
      {showThemePanel && <ThemePanel mode={themeMode} accent={themeAccent} onMode={changeMode} onAccent={changeAccent} onClose={()=>setShowThemePanel(false)}/>}

      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <div style={{width: isMobile ? '100%' : 300, flexShrink:0, display: showSidebar ? 'flex' : 'none', flexDirection:'column',...T.bgSidebar,borderRight: isMobile ? 'none' : '1px solid var(--border)'}}>

        {/* Sidebar header */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'13px 14px',...T.bgSidebarHd,borderBottom:'1px solid var(--border)'}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,color:'#fff',fontSize:16,flexShrink:0}}>
            {userName[0]?.toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{...T.textPrimary,fontWeight:600,fontSize:13}}>{userName}</div>
            <div style={{...T.textMuted,fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{myId}</div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
            <ThemeBtn/>
            <button onClick={()=>{setSelectedPeer(null);setScreen('connect')}}
              style={{background:'none',border:'1px solid var(--accent)',...T.accent,borderRadius:10,padding:'4px 9px',fontSize:11,cursor:'pointer'}}>
              + New
            </button>
          </div>
        </div>

        {/* Contacts */}
        <div style={{flex:1,overflowY:'auto'}}>
          {sortedContacts.length===0 ? (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',...T.textMuted,fontSize:12,textAlign:'center',padding:16}}>
              <span style={{fontSize:36,marginBottom:10}}>💬</span>
              No chats yet.<br/>Tap <strong style={T.accent}>+ New</strong> to start.
            </div>
          ):(
            sortedContacts.map(([pid,c]) => {
              const msgs    = sessions[sessionKey(myId,pid)]||[]
              const lastTxt = msgs.length ? msgs[msgs.length-1].text : 'No messages'
              const isActive= selectedPeer===pid
              const online  = c.online && !!connectionsRef.current[pid]?.open
              return (
                <div key={pid} onClick={()=>openChat(pid)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer',
                    borderBottom:'1px solid var(--border)',
                    background:isActive?'var(--bg-item-active)':'transparent',
                    transition:'background 0.15s'}}>
                  <div style={{position:'relative',flexShrink:0}}>
                    <div style={{width:42,height:42,borderRadius:'50%',
                      background:`linear-gradient(135deg,rgba(var(--accent-rgb),0.5),rgba(var(--accent-rgb),0.2))`,
                      display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:17}}>
                      {pid[0]?.toUpperCase()}
                    </div>
                    {/* Traffic-light: accent = online, gray = offline */}
                    <span style={{position:'absolute',bottom:1,right:1,width:12,height:12,borderRadius:'50%',
                      background:online?'var(--online-dot)':'var(--offline-dot)',
                      border:'var(--dot-border)',
                      boxShadow:online?`0 0 5px rgba(var(--accent-rgb),0.7)`:'none',
                      transition:'background 0.3s'}} title={online?'Online':'Offline'}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:2}}>
                      <span style={{...T.textPrimary,fontWeight:500,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{pid}</span>
                      {c.lastTs && <span style={{...T.textMuted,fontSize:10,flexShrink:0,marginLeft:4}}>
                        {new Date(c.lastTs).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                      </span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      <span style={{fontSize:10,fontWeight:600,color:online?'var(--online-dot)':'var(--offline-dot)',flexShrink:0}}>
                        {online?'● Online':'● Offline'}
                      </span>
                      <span style={{...T.textMuted,fontSize:10}}>·</span>
                      <span style={{...T.textSecondary,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {lastTxt.length>30?lastTxt.slice(0,30)+'…':lastTxt}
                      </span>
                    </div>
                  </div>
                  {c.unread>0&&!isActive&&(
                    <span style={{background:'var(--accent)',color:'#fff',borderRadius:99,padding:'2px 6px',fontSize:10,fontWeight:700,flexShrink:0}}>{c.unread}</span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── MAIN PANEL ──────────────────────────────────── */}
      <div style={{flex:1,display: showChat ? 'flex' : 'none',flexDirection:'column',minWidth:0,background:'var(--bg-chat)',width: isMobile ? '100%' : undefined}}>
        {selectedPeer ? (
          <>
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',...T.bgSidebarHd,borderBottom:'1px solid var(--border)',boxShadow:'var(--shadow)'}}>
              {/* Mobile: back button to return to sidebar */}
              {isMobile && (
                <button
                  onClick={() => setMobilePanelView('sidebar')}
                  style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',fontSize:22,padding:'0 4px',lineHeight:1,flexShrink:0}}
                  title="Back to chats"
                >←</button>
              )}
              <div style={{position:'relative'}}>
                <div style={{width:38,height:38,borderRadius:'50%',
                  background:`linear-gradient(135deg,rgba(var(--accent-rgb),0.5),rgba(var(--accent-rgb),0.2))`,
                  display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:16}}>
                  {selectedPeer[0]?.toUpperCase()}
                </div>
                <span style={{position:'absolute',bottom:0,right:0,width:11,height:11,borderRadius:'50%',
                  background:isPeerOnline?'var(--online-dot)':'var(--offline-dot)',
                  border:'2.5px solid var(--bg-sidebar-hd)',
                  boxShadow:isPeerOnline?`0 0 5px rgba(var(--accent-rgb),0.7)`:'none'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{...T.textPrimary,fontWeight:600,fontSize:15}}>{selectedPeer}</div>
                <div style={{fontSize:11,fontWeight:600,color:isPeerOnline?'var(--online-dot)':'var(--offline-dot)'}}>
                  {isPeerOnline?'● Online':'● Offline — showing chat history'}
                </div>
              </div>
              <div style={{background:`rgba(var(--accent-rgb),0.1)`,border:`1px solid rgba(var(--accent-rgb),0.2)`,borderRadius:10,padding:'4px 10px',fontSize:11,...T.accent}}>
                {activeMessages.length} msg{activeMessages.length!==1?'s':''}
              </div>
              {!isPeerOnline && (
                <button onClick={()=>connectToPeer(selectedPeer)}
                  style={{background:'none',border:`1px solid rgba(var(--accent-rgb),0.4)`,...T.accent,borderRadius:10,padding:'5px 12px',fontSize:12,cursor:'pointer'}}>
                  Reconnect
                </button>
              )}
              <button onClick={closeChat} style={{background:'none',border:'none',...T.textMuted,cursor:'pointer',fontSize:16,padding:'4px 8px'}}>✕</button>
            </div>

            {/* Session strip */}
            <div style={{padding:'5px 18px',background:`rgba(var(--accent-rgb),0.04)`,borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:11,color:`rgba(var(--accent-rgb),0.6)`}}>🔒</span>
              <span style={{...T.textMuted,fontSize:11}}>
                Private thread: <strong style={T.textSecondary}>{myId}</strong> ↔ <strong style={T.textSecondary}>{selectedPeer}</strong>
              </span>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',padding:'16px 18px',...T.bgMessages}}>
              {activeMessages.length===0 ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',...T.textMuted,fontSize:13}}>
                  <span style={{fontSize:40,marginBottom:12}}>👋</span>No messages yet. Say hello!
                </div>
              ):(
                activeMessages.map((msg,idx)=>(
                  <div key={idx} style={{display:'flex',justifyContent:msg.sender==='me'?'flex-end':'flex-start',marginBottom:8}}>
                    <div style={{
                      maxWidth:'68%',padding:'10px 14px',
                      borderRadius:msg.sender==='me'?'18px 18px 4px 18px':'18px 18px 18px 4px',
                      background:msg.sender==='me'?'var(--bg-bubble-me)':'var(--bg-bubble-peer)',
                      color:msg.sender==='me'?'var(--text-bubble-me)':'var(--text-bubble-peer)',
                      fontSize:14,boxShadow:'var(--shadow)',
                    }}>
                      <div style={{wordBreak:'break-word'}}>{msg.text}</div>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:4,marginTop:4}}>
                        <span style={{color:'var(--text-timestamp)',fontSize:11}}>
                          {new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef}/>
            </div>

            {/* Input bar */}
            <div style={{...T.bgInputBar,borderTop:'1px solid var(--border)',padding:'11px 14px'}}>
              {errorMsg && <div style={{color:'rgba(251,191,36,0.85)',fontSize:12,marginBottom:7,display:'flex',alignItems:'center',gap:5}}><span>⚠</span>{errorMsg}</div>}
              <form onSubmit={sendMessage} style={{display:'flex',alignItems:'center',gap:10}}>
                <input type="text"
                  placeholder={isPeerOnline?`Message ${selectedPeer}…`:`${selectedPeer} is offline — message saved locally`}
                  value={inputValue} onChange={e=>setInputValue(e.target.value.slice(0,MAX_MSG_LEN))}
                  style={{flex:1,padding:'11px 18px',borderRadius:24,...T.bgInput,border:'1px solid var(--border)',fontSize:14,outline:'none',boxSizing:'border-box'}}
                  maxLength={MAX_MSG_LEN}/>
                <button type="submit" disabled={!inputValue.trim()}
                  style={{width:44,height:44,borderRadius:'50%',background:'var(--accent)',color:'#fff',border:'none',cursor:'pointer',fontSize:18,
                    display:'flex',alignItems:'center',justifyContent:'center',opacity:inputValue.trim()?1:0.4,flexShrink:0}}>➤</button>
              </form>
            </div>
          </>
        ):(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',...T.textMuted}}>
            <span style={{fontSize:56,marginBottom:16}}>💬</span>
            <h2 style={{...T.textSecondary,fontWeight:500,fontSize:18,margin:'0 0 8px'}}>P2P Chat</h2>
            <p style={{fontSize:13,textAlign:'center',maxWidth:280,lineHeight:1.6}}>
              Pick a conversation from the left panel,<br/>or tap <strong style={T.accent}>+ New</strong> to connect to a peer.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
