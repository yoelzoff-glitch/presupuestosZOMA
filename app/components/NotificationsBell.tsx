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
} from 'lucide-react'

type NotificationItem = {
  id: string
  company_id: string
  title: string
  message: string
  type: string
  link: string | null
  read: boolean
  created_at: string
}

export default function NotificationsBell() {
  const [companyId, setCompanyId] = useState<string | null>(null)
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
    if (!companyId) return

    const interval = window.setInterval(() => {
      loadNotifications(companyId, null, false)
    }, 10000)

    const channel = supabase
      .channel(`notifications-${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          loadNotifications(companyId, null, false)
        }
      )
      .subscribe()

    return () => {
      window.clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [companyId])

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

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  async function initNotifications() {
    setLoading(true)

    const currentCompanyId = await getCompanyId()

    if (!currentCompanyId) {
      setCompanyId(null)
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    setCompanyId(currentCompanyId)
    const role = await getUserRole()
    setUserRole(role)
    await loadNotifications(currentCompanyId, role)
    setLoading(false)
  }

  async function getUserRole() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return null

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    return profile?.role || 'vendedor'
  }

  async function getCompanyId() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData.user) return null

    const { data: profile, error } = await supabase
      .from('users_profiles')
      .select('company_id')
      .eq('id', userData.user.id)
      .single()

    if (error || !profile?.company_id) return null

    return profile.company_id as string
  }

  async function loadNotifications(
    currentCompanyId: string,
    role?: string | null,
    showLoading = true
  ) {
    if (showLoading) setLoading(true)

    const { data, error } = await supabase
      .from('notifications')
      .select('id, company_id, title, message, type, link, read, created_at')
      .eq('company_id', currentCompanyId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error cargando notificaciones:', error)
      if (showLoading) setLoading(false)
      return
    }

    let loadedNotifications = data || []

    const currentRole = role || userRole
    if (currentRole === 'vendedor') {
      loadedNotifications = loadedNotifications.filter(
        (n) => n.type !== 'new_order'
      )
    }

    loadedNotifications = loadedNotifications.slice(0, 8)

    setNotifications(loadedNotifications)
    setUnreadCount(loadedNotifications.filter((item) => !item.read).length)

    if (showLoading) setLoading(false)
  }

  async function markAllAsRead() {
    if (!companyId || unreadCount === 0) return

    setMarking(true)

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('company_id', companyId)
      .eq('read', false)

    if (error) {
      console.error('Error marcando notificaciones como leídas:', error)
      setMarking(false)
      return
    }

    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        read: true,
      }))
    )

    setUnreadCount(0)
    setMarking(false)
  }

  async function markAsRead(id: string) {
    const notification = notifications.find((item) => item.id === id)

    if (!notification || notification.read) return

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    if (error) {
      console.error('Error marcando notificación como leída:', error)
      return
    }

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              read: true,
            }
          : item
      )
    )

    setUnreadCount((prev) => Math.max(prev - 1, 0))
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)

          if (companyId) {
            loadNotifications(companyId, null, false)
          }
        }}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
        aria-label="Notificaciones"
      >
        {loading ? (
          <Loader2 size={19} className="animate-spin text-blue-600" />
        ) : (
          <Bell size={19} />
        )}

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-black text-white shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-950">
                  Notificaciones
                </h3>

                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {unreadCount > 0
                    ? `${unreadCount} sin leer`
                    : 'No tenés pendientes'}
                </p>
              </div>

              <button
                type="button"
                onClick={markAllAsRead}
                disabled={marking || unreadCount === 0}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {marking ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCheck size={14} />
                )}
                Leer todo
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                  <Bell size={26} />
                </div>

                <h4 className="font-black text-slate-900">
                  Sin notificaciones
                </h4>

                <p className="mt-1 text-sm text-slate-500">
                  Cuando haya novedades importantes, aparecerán acá.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 transition ${
                      notification.read ? 'bg-white' : 'bg-blue-50/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          notification.read
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <PackageCheck size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-950">
                          {notification.title}
                        </p>

                        <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">
                          {notification.message}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                            <Clock3 size={12} />
                            {formatDate(notification.created_at)}
                          </span>

                          {!notification.read && (
                            <button
                              type="button"
                              onClick={() => markAsRead(notification.id)}
                              className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-700 shadow-sm transition hover:bg-blue-100"
                            >
                              Marcar leída
                            </button>
                          )}

                          {notification.link && (
                            <Link
                              href={notification.link}
                              onClick={() => {
                                markAsRead(notification.id)
                                setOpen(false)
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white transition hover:bg-blue-500"
                            >
                              Ver
                              <ExternalLink size={12} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3">
            <Link
              href="/notificaciones"
              onClick={() => setOpen(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"
            >
              Ver todas las notificaciones
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}