'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Send, Loader2, User as UserIcon, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

type Message = {
  id: string
  order_id: string
  sender_id: string
  message: string
  created_at: string
  profiles?: {
    full_name: string
    role: string
  }
}

interface OrderChatProps {
  orderId: string
  companyId: string
  currentUserId: string
}

export default function OrderChat({ orderId, companyId, currentUserId }: OrderChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages()

    // Suscribirse a cambios en tiempo real para este pedido específico
    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_messages',
          filter: `order_id=eq.${orderId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message
          
          // Traer el perfil del remitente para mostrar el nombre
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
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  useEffect(() => {
    // Scroll al fondo cuando hay mensajes nuevos
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function loadMessages() {
    try {
      const { data, error } = await supabase
        .from('order_messages')
        .select(`
          id,
          order_id,
          sender_id,
          message,
          created_at,
          profiles:users_profiles (
            full_name,
            role
          )
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data as any || [])
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const { error } = await supabase.from('order_messages').insert({
        company_id: companyId,
        order_id: orderId,
        sender_id: currentUserId,
        message: newMessage.trim(),
      })

      if (error) throw error
      setNewMessage('')
    } catch (error) {
      console.error('Error enviando mensaje:', error)
      toast.error('No se pudo enviar el mensaje.')
    } finally {
      setSending(false)
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex h-[500px] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      {/* Header del Chat */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <MessageSquare size={20} />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">Chat del pedido</h3>
          <p className="text-xs font-semibold text-slate-500 text-emerald-600 flex items-center gap-1">
            <span className="block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            En vivo
          </p>
        </div>
      </div>

      {/* Mensajes */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center p-6">
            <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
              <MessageSquare size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500">
              No hay mensajes aún.<br />¡Iniciá la conversación!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId
            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Nombre y Rol */}
                  <span className="mb-1 px-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {msg.profiles?.full_name || 'Usuario'} • {msg.profiles?.role}
                  </span>
                  
                  {/* Burbuja */}
                  <div className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm ${
                    isMe 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                  }`}>
                    {msg.message}
                  </div>
                  
                  {/* Hora */}
                  <span className="mt-1 px-2 text-[10px] font-bold text-slate-400">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t border-slate-100 p-4 bg-white">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 transition-within:border-blue-500 transition-within:ring-4 transition-within:ring-blue-100">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribí un mensaje..."
            className="flex-1 bg-transparent px-3 py-2 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </form>
    </div>
  )
}
