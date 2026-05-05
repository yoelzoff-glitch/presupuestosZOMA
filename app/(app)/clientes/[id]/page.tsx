'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft,
  User,
  Save,
  Loader2,
  ToggleLeft,
  ToggleRight,
  IdCard,
  MapPin,
  Building2,
  ShieldCheck,
} from 'lucide-react'

type ClientStatus = boolean | null

export default function EditarCliente() {
  const params = useParams()
  const id = params.id as string

  const [cuit, setCuit] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [active, setActive] = useState<ClientStatus>(true)

  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadClient()
    }
  }, [id])

  async function loadClient() {
    setInitialLoading(true)

    const { data, error } = await supabase
      .from('clients')
      .select('id, cuit, name, address, active')
      .eq('id', id)
      .single()

    if (error) {
      toast.error('Error al cargar cliente')
      setInitialLoading(false)
      return
    }

    if (data) {
      setCuit(data.cuit || '')
      setName(data.name || '')
      setAddress(data.address || '')
      setActive(data.active !== false)
    }

    setInitialLoading(false)
  }

  async function updateClient() {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('clients')
      .update({
        cuit: cuit.trim(),
        name: name.trim(),
        address: address.trim(),
      })
      .eq('id', id)

    setLoading(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Cliente actualizado correctamente')
  }

  async function toggleClientStatus() {
    const currentActive = active !== false
    const nextActive = !currentActive

    const confirmMessage = nextActive
      ? '¿Querés volver a activar este cliente?'
      : '¿Querés marcar este cliente como inactivo?'

    const confirmed = window.confirm(confirmMessage)

    if (!confirmed) return

    setStatusLoading(true)

    const { error } = await supabase
      .from('clients')
      .update({
        active: nextActive,
      })
      .eq('id', id)

    setStatusLoading(false)

    if (error) {
      toast.error('No se pudo actualizar el estado del cliente')
      return
    }

    setActive(nextActive)

    toast.success(
      nextActive
        ? 'Cliente activado correctamente'
        : 'Cliente marcado como inactivo'
    )
  }

  const isActive = active !== false

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/clientes"
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-200 transition hover:text-white"
            >
              <ArrowLeft size={17} />
              Volver a clientes
            </Link>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
              <User size={14} />
              Cliente
            </div>

            <h1 className="text-3xl font-black tracking-tight">
              Editar cliente
            </h1>

            <p className="mt-2 text-sm text-slate-300">
              Modificá los datos del cliente y administrá si está activo o inactivo.
            </p>
          </div>

          {!initialLoading && (
            <StatusBadge active={isActive} />
          )}
        </div>
      </section>

      {initialLoading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-50 text-blue-700">
            <Loader2 size={26} className="animate-spin" />
          </div>

          <h2 className="text-lg font-black text-slate-900">
            Cargando cliente
          </h2>

          <p className="mt-1 text-sm font-semibold text-slate-500">
            Estamos buscando los datos registrados.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <InfoCard
              icon={Building2}
              title="Cliente"
              value={name || 'Sin nombre'}
            />

            <InfoCard
              icon={IdCard}
              title="CUIT"
              value={cuit || 'Sin CUIT'}
            />

            <InfoCard
              icon={ShieldCheck}
              title="Estado"
              value={isActive ? 'Activo' : 'Inactivo'}
            />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-black text-slate-950">
                Datos del cliente
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Estos datos se usan en presupuestos, cuenta corriente y consultas comerciales.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  CUIT
                </label>

                <div className="relative">
                  <IdCard
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={cuit}
                    onChange={(e) => setCuit(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="Ej: 30-12345678-9"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Nombre / Razón Social *
                </label>

                <div className="relative">
                  <User
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="Ej: Juan Pérez SRL"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Dirección
                </label>

                <div className="relative">
                  <MapPin
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    placeholder="Ej: Av. Corrientes 1234"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">
                  Estado del cliente
                </h2>

                <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                  Un cliente inactivo queda identificado como tal para evitar usarlo por error
                  en nuevas operaciones, pero no se elimina su historial.
                </p>
              </div>

              <button
                type="button"
                onClick={toggleClientStatus}
                disabled={statusLoading}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActive
                    ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {statusLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isActive ? (
                  <ToggleRight size={19} />
                ) : (
                  <ToggleLeft size={19} />
                )}

                {statusLoading
                  ? 'Actualizando...'
                  : isActive
                    ? 'Marcar como inactivo'
                    : 'Activar cliente'}
              </button>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/clientes"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
              Volver
            </Link>

            <button
              type="button"
              onClick={updateClient}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}

              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function StatusBadge({ active }: { active: boolean }) {
  if (!active) {
    return (
      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700">
        <ToggleLeft size={18} />
        Inactivo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
      <ToggleRight size={18} />
      Activo
    </span>
  )
}

function InfoCard({
  icon: Icon,
  title,
  value,
}: {
  icon: any
  title: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-500">
            {title}
          </p>

          <h2 className="truncate text-xl font-black text-slate-950">
            {value}
          </h2>
        </div>
      </div>
    </div>
  )
}