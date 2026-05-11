'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Bell,
  CheckCheck,
  Clock3,
  ExternalLink,
  Loader2,
  PackageCheck,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

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

type Props = {
  initialNotifications: NotificationItem[]
  companyId: string
  userId: string
}

export default function NotificacionesClient({
  initialNotifications,
  companyId,
  userId,
}: Props) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  const [loading, setLoading] = useState(false)
  const [marking, setMarking] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [errorMsg, setErrorMsg] = useState('')

  async function refreshNotifications() {
    setLoading(true)
    setErrorMsg('')

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('company_id', companyId)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      setErrorMsg('No se pudieron cargar las notificaciones.')
    } else {
      setNotifications(data || [])
    }
    setLoading(false)
  }

  async function markAllAsRead() {
    if (!companyId) return

    setMarking(true)

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('company_id', companyId)
      .eq('read', false)

    if (!error) {
      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          read: true,
        }))
      )
    }

    setMarking(false)
  }

  async function markAsRead(id: string) {
    const notification = notifications.find((item) => item.id === id)

    if (!notification || notification.read) return

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)

    if (!error) {
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
    }
  }

  const filteredNotifications = useMemo(() => {
    const q = search.toLowerCase().trim()

    return notifications.filter((notification) => {
      const matchesSearch =
        !q ||
        notification.title.toLowerCase().includes(q) ||
        notification.message.toLowerCase().includes(q) ||
        notification.type.toLowerCase().includes(q)

      const matchesFilter =
        filter === 'all' ||
        (filter === 'unread' && !notification.read) ||
        (filter === 'read' && notification.read)

      return matchesSearch && matchesFilter
    })
  }, [notifications, search, filter])

  const unreadCount = notifications.filter((item) => !item.read).length
  const readCount = notifications.filter((item) => item.read).length

  function formatDate(date: string) {
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-blue-200">
              <Bell size={14} />
              Centro de avisos
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Notificaciones
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Revisá novedades importantes del sistema, pedidos recibidos y acciones que requieren atención.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={refreshNotifications}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={markAllAsRead}
              disabled={marking || unreadCount === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {marking ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCheck size={18} />
              )}
              Marcar todo leído
            </button>
          </div>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {errorMsg}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total"
          value={notifications.length}
          icon={Bell}
          tone="blue"
          loading={loading}
        />

        <StatCard
          title="Sin leer"
          value={unreadCount}
          icon={Clock3}
          tone="amber"
          loading={loading}
        />

        <StatCard
          title="Leídas"
          value={readCount}
          icon={CheckCheck}
          tone="green"
          loading={loading}
        />
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-200 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Bandeja de notificaciones
              </h2>

              <p className="text-sm text-slate-500">
                Filtrá por estado o buscá por título, mensaje o tipo.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar notificación..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 sm:w-80"
                />
              </div>

              <select
                value={filter}
                onChange={(e) =>
                  setFilter(e.target.value as 'all' | 'unread' | 'read')
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="all">Todas</option>
                <option value="unread">Sin leer</option>
                <option value="read">Leídas</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
              <Loader2 size={26} className="animate-spin" />
            </div>

            <h3 className="text-lg font-black text-slate-900">
              Cargando notificaciones
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Estamos buscando los avisos registrados.
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
              <Bell size={26} />
            </div>

            <h3 className="text-lg font-black text-slate-900">
              No hay notificaciones para mostrar
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Cuando haya novedades importantes, aparecerán acá.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map((notification) => (
              <article
                key={notification.id}
                className={`p-5 transition ${
                  notification.read ? 'bg-white' : 'bg-blue-50/40'
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        notification.read
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      <PackageCheck size={22} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black text-slate-950">
                          {notification.title}
                        </h3>

                        {!notification.read && (
                          <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-black text-white">
                            Nueva
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                        {notification.message}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                          <Clock3 size={13} />
                          {formatDate(notification.created_at)}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-500">
                          {notification.type}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    {!notification.read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <CheckCheck size={16} />
                        Marcar leída
                      </button>
                    )}

                    {notification.link && (
                      <Link
                        href={notification.link}
                        onClick={() => markAsRead(notification.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500"
                      >
                        Ver detalle
                        <ExternalLink size={16} />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  title: string
  value: number
  icon: any
  tone: 'blue' | 'amber' | 'green'
  loading: boolean
}) {
  const styles = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-emerald-50 text-emerald-700',
  }

  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles[tone]}`}
        >
          <Icon size={23} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">
            {title}
          </p>

          <h2 className="truncate text-2xl font-black text-slate-950">
            {loading ? '...' : value}
          </h2>
        </div>
      </div>
    </div>
  )
}