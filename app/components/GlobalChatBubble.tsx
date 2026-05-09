'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Send, Loader2, MessageSquare, X, Minus } from 'lucide-react'
import { toast } from 'sonner'

type Message = {
  id: string
  company_id: string
  sender_id: string
  message: string
  created_at: string
  profiles?: {
    full_name: string
    role: string
  }
}

export default function GlobalChatBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initChat()
  }, [])

  useEffect(() => {
    if (!companyId) return

    // Cargar mensajes iniciales
    loadMessages(companyId)

    // Suscribirse a tiempo real global de la empresa
    const channel = supabase
      .channel(`global-chat-${companyId}`)
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
          
          // Traer perfil
          const { data: profile } = await supabase
            .from('users_profiles')
            .select('full_name, role')
            .eq('id', newMsg.sender_id)
            .single()

          const msgWithProfile = {
            ...newMsg,
            profiles: profile || undefined
          }

          setMessages((prev) => [...prev, msgWithProfile])
          
          if (!isOpen) {
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId, isOpen])

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      }, 100)
    }
  }, [isOpen, messages])

  async function initChat() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    setCurrentUserId(userData.user.id)

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    if (profile?.company_id) {
      setCompanyId(profile.company_id)
    }
  }

  async function loadMessages(cid: string) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('company_messages')
        .select(`
          id,
          company_id,
          sender_id,
          message,
          created_at,
          profiles:users_profiles (
            full_name,
            role
          )
        `)
        .eq('company_id', cid)
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) throw error
      setMessages(data as any || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !companyId || !currentUserId || sending) return

    setSending(true)
    try {
      const { error } = await supabase.from('company_messages').insert({
        company_id: companyId,
        sender_id: currentUserId,
        message: newMessage.trim(),
      })

      if (error) throw error
      setNewMessage('')
    } catch (error) {
      toast.error('Error al enviar mensaje')
    } finally {
      setSending(false)
    }
  }

  if (!companyId) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4">
      {/* Ventana de Chat */}
      {isOpen && (
        <div className="flex h-[500px] w-[360px] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-950 p-5 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-base font-black">Chat Interno</h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Canal de la empresa</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="rounded-xl p-2 transition hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-4"
          >
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 size={24} className="animate-spin text-blue-600" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                <MessageSquare size={32} className="mb-2 opacity-20" />
                <p className="text-sm font-bold">¡Saludá al equipo!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="mb-1 px-1 text-[9px] font-black uppercase text-slate-400">
                      {msg.profiles?.full_name} • {msg.profiles?.role}
                    </span>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm font-semibold shadow-sm ${
                      isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <form onSubmit={sendMessage} className="border-t border-slate-100 p-4">
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
        </div>
      )}

      {/* Burbuja Flotante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
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
