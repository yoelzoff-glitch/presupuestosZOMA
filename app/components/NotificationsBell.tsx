'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Bell,
  CheckCheck,
  Clock3,
  ExternalLink,
  Loader2,
  PackageCheck,
  ChevronRight,
  Info
} from 'lucide-react'

type NotificationItem = {
  id: string
  company_id: string
  user_id: string | null
  title: string
  message: string
  type: string
  link: string | null
  read: boolean
  created_at: string
}

export default function NotificationsBell() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    initNotifications()
  }, [])

  useEffect(() => {
    if (!companyId || !currentUserId) return

    const channel = supabase
      .channel(`notifications-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem
          // Solo recargar si es para este usuario o global de la empresa
          if (!newNotif.user_id || newNotif.user_id === currentUserId) {
            loadNotifications(companyId, currentUserId, userRole, false)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [companyId, currentUserId, userRole])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function initNotifications() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const myId = userData.user.id
    setCurrentUserId(myId)

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('company_id, role')
      .eq('id', myId)
      .single()

    if (profile?.company_id) {
      setCompanyId(profile.company_id)
      setUserRole(profile.role)
      await loadNotifications(profile.company_id, myId, profile.role)
    }
    setLoading(false)
  }

  async function loadNotifications(
    cid: string,
    uid: string,
    role: string | null,
    showLoading = true
  ) {
    if (showLoading) setLoading(true)

    // Consultamos notificaciones donde el user_id sea nulo (global) o sea para mí
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('company_id', cid)
      .or(`user_id.is.null,user_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error cargando notificaciones:', error)
      if (showLoading) setLoading(false)
      return
    }

    let loadedNotifications = data || []

    // Filtrar 'new_order' para vendedores (estos son solo para admin usualmente)
    if (role === 'vendedor') {
      loadedNotifications = loadedNotifications.filter(
        (n) => n.type !== 'new_order'
      )
    }

    setNotifications(loadedNotifications)
    setUnreadCount(loadedNotifications.filter((item) => !item.read).length)
    if (showLoading) setLoading(false)
  }

  async function markAllAsRead() {
    if (!companyId || !currentUserId || unreadCount === 0) return
    setMarking(true)

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('company_id', companyId)
      .or(`user_id.is.null,user_id.eq.${currentUserId}`)
      .eq('read', false)

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    }
    setMarking(false)
  }

  async function markAsRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  function formatDate(date: string) {
    const d = new Date(date)
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const isAdmin = userRole === 'admin'

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen(!open)
          if (!open && companyId && currentUserId) loadNotifications(companyId, currentUserId, userRole, false)
        }}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 ${
          open 
            ? 'border-blue-500 bg-blue-50 text-blue-600 shadow-inner' 
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <Bell size={20} className={unreadCount > 0 ? 'animate-wiggle' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-black text-white shadow-lg ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header */}
          <div className="border-b border-slate-100 bg-slate-50/50 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Notificaciones</h3>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${unreadCount > 0 ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {unreadCount} pendientes
                  </span>
                </div>
              </div>
              
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={marking || unreadCount === 0}
                className="group flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-blue-600 transition hover:bg-blue-100/50 disabled:opacity-30"
              >
                {marking ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={14} />}
                Leer todas
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 size={24} className="animate-spin text-blue-600" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-50 text-slate-300">
                  <Bell size={32} />
                </div>
                <h4 className="text-sm font-black text-slate-900">Todo al día</h4>
                <p className="mt-1 text-xs font-semibold text-slate-500">No tenés notificaciones nuevas por ahora.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`group relative p-4 transition-all duration-200 hover:bg-slate-50 ${!n.read ? 'bg-blue-50/30' : ''}`}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-0 h-full w-0.5 bg-blue-600" />
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                        !n.read ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {n.type === 'new_order' ? <PackageCheck size={18} /> : <Info size={18} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-black truncate ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                            {formatDate(n.created_at)}
                          </span>
                        </div>
                        
                        <p className={`mt-1 text-xs leading-relaxed ${!n.read ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>
                          {n.message}
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                          {n.link && (
                            <Link
                              href={n.link}
                              onClick={() => {
                                markAsRead(n.id)
                                setOpen(false)
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black text-white transition hover:bg-slate-800"
                            >
                              Gestionar
                              <ChevronRight size={12} />
                            </Link>
                          )}
                          {!n.read && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-blue-600 transition"
                            >
                              Marcar leída
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - SOLO PARA ADMIN */}
          {isAdmin && (
            <div className="border-t border-slate-100 p-3 bg-slate-50/30">
              <Link
                href="/notificaciones"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300"
              >
                Historial completo
                <ExternalLink size={14} className="text-slate-400" />
              </Link>
            </div>
          )}
        </div>
      )}
      
      <style jsx global>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(10deg); }
          75% { transform: rotate(-10deg); }
        }
        .animate-wiggle {
          animation: wiggle 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}