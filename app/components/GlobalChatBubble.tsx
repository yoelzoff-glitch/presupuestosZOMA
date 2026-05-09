'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Send, Loader2, MessageSquare, X, Minus, Users, User as UserIcon, ChevronLeft } from 'lucide-react'
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
  const [unreadCount, setUnreadCount] = useState(0)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedUserRef = useRef<ChatUser | null>(null)
  const viewRef = useRef<'contacts' | 'messages'>('contacts')

  useEffect(() => {
    selectedUserRef.current = selectedUser
    viewRef.current = view
  }, [selectedUser, view])

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    if (!companyId || !currentUserId) return

    const channel = supabase
      .channel(`company-chat-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_messages',
          filter: `company_id=eq.${companyId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message
          console.log('Nuevo mensaje recibido en tiempo real:', newMsg)
          
          const isForMe = !newMsg.receiver_id || newMsg.receiver_id === currentUserId || newMsg.sender_id === currentUserId
          if (!isForMe) return

          const { data: profile } = await supabase
            .from('users_profiles')
            .select('full_name, role')
            .eq('id', newMsg.sender_id)
            .single()

          const msgWithProfile = { ...newMsg, profiles: profile || undefined }

          const currentSelUser = selectedUserRef.current
          const currentView = viewRef.current

          const isGlobalChat = !currentSelUser && !newMsg.receiver_id
          const isPrivateChat = currentSelUser && (
            (newMsg.sender_id === currentSelUser.id && newMsg.receiver_id === currentUserId) ||
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === currentSelUser.id)
          )

          if (currentView === 'messages' && (isGlobalChat || isPrivateChat)) {
            setMessages((prev) => [...prev, msgWithProfile])
          } else {
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId, currentUserId])

  useEffect(() => {
    if (isOpen && view === 'messages') {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      }, 100)
    }
  }, [messages, view, isOpen])

  async function initChat() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    setCurrentUserId(userData.user.id)

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', userData.user.id)
      .single()

    if (profile?.company_id) {
      setCompanyId(profile.company_id)
      loadUsers(profile.company_id, userData.user.id)
    }
  }

  async function loadUsers(cid: string, myId: string) {
    const { data } = await supabase
      .from('users_profiles')
      .select('id, full_name, role')
      .eq('company_id', cid)
      .neq('id', myId)
      .order('full_name')
    
    setUsers(data as ChatUser[] || [])
  }

  async function loadMessages(targetUserId: string | null) {
    if (!companyId || !currentUserId) return
    setLoading(true)
    setMessages([])

    try {
      // Cargamos todos los mensajes de la empresa y filtramos en el cliente
      // Esto es mucho más robusto que los filtros complejos de Postgrest
      const { data, error } = await supabase
        .from('company_messages')
        .select(`
          id,
          company_id,
          sender_id,
          receiver_id,
          message,
          created_at,
          profiles:users_profiles!sender_id (
            full_name,
            role
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })

      if (error) throw error

      const rawMessages = (data || []).map(m => ({
        ...m,
        profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
      })) as Message[]
      
      let filtered: Message[] = []

      if (targetUserId) {
        filtered = rawMessages.filter(m => 
          (m.sender_id === currentUserId && m.receiver_id === targetUserId) ||
          (m.sender_id === targetUserId && m.receiver_id === currentUserId)
        )
      } else {
        filtered = rawMessages.filter(m => !m.receiver_id)
      }

      setMessages(filtered)
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !companyId || !currentUserId || sending) return

    setSending(true)
    const targetId = selectedUser?.id || null

    try {
      const { error } = await supabase.from('company_messages').insert({
        company_id: companyId,
        sender_id: currentUserId,
        receiver_id: targetId,
        message: newMessage.trim(),
      })

      if (error) throw error
      setNewMessage('')
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      toast.error('Error al enviar mensaje')
    } finally {
      setSending(false)
    }
  }

  function openConversation(user: ChatUser | null) {
    setSelectedUser(user)
    setView('messages')
    setUnreadCount(0)
    loadMessages(user?.id || null)
  }

  if (!companyId) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4">
      {/* Ventana de Chat */}
      {isOpen && (
        <div className="flex h-[550px] w-[380px] flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-950 p-5 text-white">
            <div className="flex items-center gap-3">
              {view === 'messages' && (
                <button 
                  onClick={() => setView('contacts')}
                  className="mr-1 rounded-xl p-1.5 transition hover:bg-white/10"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30">
                {view === 'contacts' ? <Users size={20} /> : <UserIcon size={20} />}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black truncate max-w-[180px]">
                  {view === 'contacts' ? 'Mensajería' : (selectedUser?.full_name || 'Muro General')}
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  {view === 'contacts' ? 'Seleccioná un chat' : (selectedUser ? 'Chat Privado' : 'Canal Global')}
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="rounded-xl p-2 transition hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          {/* Vista de Contactos */}
          {view === 'contacts' && (
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-2">
              <p className="px-2 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Canales</p>
              
              <button 
                onClick={() => openConversation(null)}
                className="flex w-full items-center gap-4 rounded-2xl border border-transparent bg-white p-4 text-left shadow-sm transition hover:border-blue-500/30 hover:bg-blue-50/30 group"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white transition group-hover:scale-110">
                  <Users size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-black text-slate-900">Muro General</h4>
                  <p className="text-xs font-semibold text-slate-500 truncate">Chat abierto para toda la empresa</p>
                </div>
              </button>

              <p className="px-2 mt-6 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mensajes Directos</p>
              
              {users.length === 0 ? (
                <p className="text-center py-10 text-xs font-bold text-slate-400 italic">No hay otros usuarios registrados</p>
              ) : (
                users.map(user => (
                  <button 
                    key={user.id}
                    onClick={() => openConversation(user)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-transparent bg-white p-4 text-left shadow-sm transition hover:border-blue-500/30 hover:bg-blue-50/30 group"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition group-hover:scale-110">
                      <UserIcon size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-black text-slate-900">{user.full_name}</h4>
                      <p className="text-xs font-semibold text-slate-500 truncate capitalize">{user.role}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Vista de Mensajes */}
          {view === 'messages' && (
            <>
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto bg-slate-50/30 p-4 space-y-4"
              >
                {loading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 size={24} className="animate-spin text-blue-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                    <MessageSquare size={32} className="mb-2 opacity-20" />
                    <p className="text-sm font-bold">Sin mensajes aquí.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === currentUserId
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && !selectedUser && (
                          <span className="mb-1 px-1 text-[9px] font-black uppercase text-slate-400">
                            {msg.profiles?.full_name}
                          </span>
                        )}
                        <div className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm font-semibold shadow-sm ${
                          isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                        }`}>
                          {msg.message}
                        </div>
                        <span className="mt-1 px-1 text-[8px] font-bold text-slate-400">
                          {new Date(msg.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>

              <form onSubmit={sendMessage} className="border-t border-slate-100 p-4 bg-white">
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 focus-within:border-blue-500">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribí un mensaje..."
                    className="flex-1 bg-transparent px-3 py-2 text-sm font-semibold outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* Burbuja Flotante */}
      <button
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) setView('contacts')
        }}
        className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl transition hover:scale-110 active:scale-95 ${
          unreadCount > 0 ? 'ring-4 ring-blue-100' : ''
        }`}
      >
        {isOpen ? <Minus size={28} /> : <MessageSquare size={28} />}
        
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-lg animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
