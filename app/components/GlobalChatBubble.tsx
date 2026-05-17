'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Send, Loader2, MessageSquare, X, Minus, Users, User as UserIcon, ChevronLeft, Calendar } from 'lucide-react'
import { toast } from 'sonner'

type Message = {
  id: string
  company_id: string
  sender_id: string
  receiver_id: string | null
  message: string
  created_at: string
  profiles?: {
    full_name: string
    role: string
  }
}

type ChatUser = {
  id: string
  full_name: string
  role: string
}

export default function GlobalChatBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'contacts' | 'messages'>('contacts')
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [users, setUsers] = useState<ChatUser[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [unreadChannels, setUnreadChannels] = useState<Set<string | null>>(new Set())
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [isProPlan, setIsProPlan] = useState<boolean>(false) // Por defecto false para evitar flash en plan base
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedUserRef = useRef<ChatUser | null>(null)
  const viewRef = useRef<'contacts' | 'messages'>('contacts')

  useEffect(() => {
    selectedUserRef.current = selectedUser
    viewRef.current = view
  }, [selectedUser, view])

  useEffect(() => { initChat() }, [])

  useEffect(() => {
    if (!companyId || !currentUserId) return
    const channel = supabase.channel(`company-chat-${companyId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'company_messages', filter: `company_id=eq.${companyId}` }, async (payload) => {
      const newMsg = payload.new as Message
      const isForMe = !newMsg.receiver_id || newMsg.receiver_id === currentUserId || newMsg.sender_id === currentUserId
      if (!isForMe) return
      const isFromMe = newMsg.sender_id === currentUserId
      const { data: profile } = await supabase.from('users_profiles').select('full_name, role').eq('id', newMsg.sender_id).single()
      const msgWithProfile = { ...newMsg, profiles: profile || undefined }
      const currentSelUser = selectedUserRef.current
      const currentView = viewRef.current
      const isGlobalChat = !currentSelUser && !newMsg.receiver_id
      const isPrivateChat = currentSelUser && ((newMsg.sender_id === currentSelUser.id && newMsg.receiver_id === currentUserId) || (newMsg.sender_id === currentUserId && newMsg.receiver_id === currentSelUser.id))

      if (currentView === 'messages' && (isGlobalChat || isPrivateChat)) {
        setMessages((prev) => [...prev, msgWithProfile])
      } else if (!isFromMe) {
        const channelKey = newMsg.receiver_id ? newMsg.sender_id : null
        setUnreadChannels((prev) => new Set(prev).add(channelKey))
      }
    }).subscribe()

    // PRESENCIA (Online/Offline)
    const presenceChannel = supabase.channel(`presence-${companyId}`, {
      config: { presence: { key: currentUserId } }
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel.presenceState()
        const onlineIds = new Set<string>()
        Object.keys(newState).forEach((key) => onlineIds.add(key))
        setOnlineUsers(onlineIds)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p: any) => {
          setOnlineUsers((prev) => new Set(prev).add(p.presence_ref || p.key))
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p: any) => {
          setOnlineUsers((prev) => {
            const next = new Set(prev)
            next.delete(p.presence_ref || p.key)
            return next
          })
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => { 
      supabase.removeChannel(channel) 
      supabase.removeChannel(presenceChannel)
    }
  }, [companyId, currentUserId])

  useEffect(() => {
    if (isOpen && view === 'messages') {
      setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, 100)
    }
  }, [messages, view, isOpen])

  async function initChat() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    setCurrentUserId(userData.user.id)
    const { data: profile } = await supabase.from('users_profiles').select('company_id, role').eq('id', userData.user.id).single()
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
      setCurrentUserRole(profile.role)
      
      // Validar plan de la empresa
      const { data: company } = await supabase.from('companies').select('plan_type').eq('id', profile.company_id).single()
      const isPro = company?.plan_type === 'pro'
      setIsProPlan(isPro)
      
      if (isPro) {
        loadUsers(profile.company_id, userData.user.id, profile.role)
      }
    }
  }

  async function loadUsers(cid: string, myId: string, myRole: string) {
    let query = supabase
      .from('users_profiles')
      .select('id, full_name, role')
      .eq('company_id', cid)
      .neq('id', myId)

    if (myRole === 'contador') {
      // El contador solo puede chatear con administradores
      query = query.eq('role', 'admin')
    }

    const { data } = await query.order('full_name')
    let filteredUsers = data as ChatUser[] || []

    if (myRole !== 'admin') {
      // Los no-admins (preventistas/vendedores) no deben ver al contador
      filteredUsers = filteredUsers.filter(u => u.role !== 'contador')
    }

    setUsers(filteredUsers)
  }

  async function loadMessages(targetUserId: string | null) {
    if (!companyId || !currentUserId) return
    setLoading(true); setMessages([])
    try {
      const { data, error } = await supabase.from('company_messages').select(`id, company_id, sender_id, receiver_id, message, created_at, profiles:users_profiles!sender_id ( full_name, role )`).eq('company_id', companyId).order('created_at', { ascending: true })
      if (error) throw error
      const rawMessages = (data || []).map(m => ({ ...m, profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles })) as Message[]
      let filtered: Message[] = targetUserId ? rawMessages.filter(m => (m.sender_id === currentUserId && m.receiver_id === targetUserId) || (m.sender_id === targetUserId && m.receiver_id === currentUserId)) : rawMessages.filter(m => !m.receiver_id)
      setMessages(filtered)
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !companyId || !currentUserId || sending) return
    setSending(true)
    try {
      const { error } = await supabase.from('company_messages').insert({ company_id: companyId, sender_id: currentUserId, receiver_id: selectedUser?.id || null, message: newMessage.trim() })
      if (error) throw error
      setNewMessage('')
    } catch (error) { toast.error('Error al enviar mensaje') } finally { setSending(false) }
  }

  function openConversation(user: ChatUser | null) {
    setSelectedUser(user); setView('messages')
    setUnreadChannels((prev) => { const next = new Set(prev); next.delete(user?.id || null); return next })
    loadMessages(user?.id || null)
  }

  // Funciones para separar por fecha
  function formatChatDate(dateStr: string) {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Hoy'
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer'

    return date.toLocaleDateString('es-AR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    }).replace(/^\w/, (c) => c.toUpperCase())
  }

  function isSameDay(d1: string, d2: string) {
    return new Date(d1).toDateString() === new Date(d2).toDateString()
  }

  if (!companyId || !isProPlan) return null
  const totalUnread = unreadChannels.size

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] flex flex-col items-end gap-4 max-w-[calc(100vw-32px)] sm:max-w-none">
      {isOpen && (
        <div className="flex h-[500px] sm:h-[600px] w-[calc(100vw-32px)] sm:w-[380px] flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-950 p-5 text-white">
            <div className="flex items-center gap-3">
              {view === 'messages' && ( <button onClick={() => setView('contacts')} className="mr-1 rounded-xl p-1.5 transition hover:bg-white/10"><ChevronLeft size={20} /></button> )}
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">{view === 'contacts' ? <Users size={20} /> : <UserIcon size={20} />}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black truncate max-w-[180px]">{view === 'contacts' ? 'Mensajería' : (selectedUser?.full_name || 'Muro General')}</h3>
                  {view === 'messages' && selectedUser && onlineUsers.has(selectedUser.id) && (
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  {view === 'contacts' ? 'Seleccioná un chat' : (selectedUser ? (onlineUsers.has(selectedUser.id) ? 'En línea ahora' : 'Desconectado') : 'Canal Global')}
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-xl p-2 transition hover:bg-white/10"><X size={20} /></button>
          </div>

          {view === 'contacts' && (
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-2">
              {currentUserRole !== 'contador' && (
                <>
                  <p className="px-2 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Canales</p>
                  <button onClick={() => openConversation(null)} className="relative flex w-full items-center gap-4 rounded-2xl border border-transparent bg-white p-4 text-left shadow-sm transition hover:border-blue-500/30 hover:bg-blue-50 group mb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white transition group-hover:scale-110"><Users size={22} /></div>
                    <div className="flex-1 min-w-0"><h4 className="text-sm font-black text-slate-900">Muro General</h4><p className="text-xs font-semibold text-slate-500 truncate">Chat abierto para toda la empresa</p></div>
                    {unreadChannels.has(null) && <div className="h-3 w-3 rounded-full bg-red-600 shadow-sm animate-pulse" />}
                  </button>
                </>
              )}
              <p className="px-2 mt-2 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mensajes Directos</p>
              {users.map(user => (
                <button key={user.id} onClick={() => openConversation(user)} className="relative flex w-full items-center gap-4 rounded-2xl border border-transparent bg-white p-4 text-left shadow-sm transition hover:border-blue-500/30 hover:bg-blue-50 group">
                  <div className="relative">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition group-hover:scale-110">
                      <UserIcon size={22} />
                    </div>
                    {onlineUsers.has(user.id) && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900">{user.full_name}</h4>
                      {onlineUsers.has(user.id) && <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">En línea</span>}
                    </div>
                    <p className="text-xs font-semibold text-slate-500 truncate capitalize">{user.role}</p>
                  </div>
                  {unreadChannels.has(user.id) && <div className="h-3 w-3 rounded-full bg-red-600 shadow-sm animate-pulse" />}
                </button>
              ))}
            </div>
          )}

          {view === 'messages' && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50/30 p-4 space-y-4">
                {loading ? ( <div className="flex h-full items-center justify-center"><Loader2 size={24} className="animate-spin text-blue-600" /></div> ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-400"><MessageSquare size={32} className="mb-2 opacity-20" /><p className="text-sm font-bold">Sin mensajes aquí.</p></div>
                ) : (
                  messages.map((msg, index) => {
                    const isMe = msg.sender_id === currentUserId
                    const showDateSeparator = index === 0 || !isSameDay(messages[index - 1].created_at, msg.created_at)
                    
                    return (
                      <div key={msg.id} className="space-y-4">
                        {showDateSeparator && (
                          <div className="flex items-center gap-4 my-6">
                            <div className="h-px flex-1 bg-slate-200" />
                            <div className="flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-1 shadow-sm">
                              <Calendar size={10} className="text-slate-400" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                {formatChatDate(msg.created_at)}
                              </span>
                            </div>
                            <div className="h-px flex-1 bg-slate-200" />
                          </div>
                        )}

                        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && !selectedUser && ( <span className="mb-1 px-1 text-[9px] font-black uppercase text-slate-400">{msg.profiles?.full_name}</span> )}
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm font-semibold shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>{msg.message}</div>
                          <span className="mt-1 px-1 text-[8px] font-bold text-slate-400">{new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <form onSubmit={sendMessage} className="border-t border-slate-100 p-4 bg-white">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-blue-500">
                  <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribí un mensaje..." className="flex-1 bg-transparent px-3 py-2 text-sm font-semibold outline-none" />
                  <button type="submit" disabled={!newMessage.trim() || sending} className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50">
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      <button onClick={() => { setIsOpen(!isOpen); if (!isOpen) setView('contacts') }} className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl transition hover:scale-110 active:scale-95 ${totalUnread > 0 ? 'ring-4 ring-blue-100' : ''}`}>
        {isOpen ? <Minus size={28} /> : <MessageSquare size={28} />}
        {totalUnread > 0 && <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-lg animate-bounce">{totalUnread}</span>}
      </button>
    </div>
  )
}
