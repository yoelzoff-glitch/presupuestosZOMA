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
  Mail,
  Phone,
} from 'lucide-react'

type ClientStatus = boolean | null

export default function EditarCliente() {
  const params = useParams()
  const id = params.id as string

  const [cuit, setCuit] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
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
      .select('id, cuit, name, address, active, email, phone')
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
      setEmail(data.email || '')
      setPhone(data.phone || '')
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
        cuit: cuit.trim() || null,
        name: name.trim(),
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
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
      <section className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-500/20 blur-[100px] -mr-32 -mt-32" />
        
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link
              href="/clientes"
              className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-blue-300 transition hover:text-white"
            >
              <ArrowLeft size={18} />
              Volver al listado
            </Link>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-blue-300 backdrop-blur-md">
              <Building2 size={14} />
              Gestión de Cliente
            </div>

            <h1 className="text-4xl font-black tracking-tight">
              {initialLoading ? 'Cargando...' : name}
            </h1>

            <p className="mt-2 text-base text-slate-400 font-medium">
              Actualizá la información de contacto y fiscal del cliente.
            </p>
          </div>

          {!initialLoading && (
            <StatusBadge active={isActive} />
          )}
        </div>
      </section>

      {initialLoading ? (
        <section className="rounded-[2.5rem] border-2 border-slate-100 bg-white p-16 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-blue-50 text-blue-600 shadow-inner">
            <Loader2 size={32} className="animate-spin" />
          </div>

          <h2 className="text-xl font-black text-slate-900">
            Cargando expediente
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            Estamos recuperando los datos del cliente...
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-5 md:grid-cols-3">
            <InfoCard
              icon={Mail}
              title="Contacto Mail"
              value={email || 'No registrado'}
            />

            <InfoCard
              icon={Phone}
              title="Teléfono"
              value={phone || 'No registrado'}
            />

            <InfoCard
              icon={ShieldCheck}
              title="Estado"
              value={isActive ? 'Activo' : 'Inactivo'}
            />
          </section>

          <section className="rounded-[2.5rem] border-2 border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-8 border-b border-slate-100 pb-6">
              <h2 className="text-2xl font-black text-slate-950">
                Información General
              </h2>

              <p className="mt-2 text-sm font-semibold text-slate-500">
                Los campos con <span className="text-red-500">*</span> son requeridos.
              </p>
            </div>

            <div className="space-y-8">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="group">
                  <label className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                    Nombre / Razón Social *
                  </label>

                  <div className="relative">
                    <User
                      size={20}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500"
                    />

                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-4 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                    CUIT / DNI
                  </label>

                  <div className="relative">
                    <IdCard
                      size={20}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500"
                    />

                    <input
                      value={cuit}
                      onChange={(e) => setCuit(e.target.value)}
                      className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-4 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="group">
                  <label className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                    Email de contacto
                  </label>

                  <div className="relative">
                    <Mail
                      size={20}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500"
                    />

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-4 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                    Teléfono / WhatsApp
                  </label>

                  <div className="relative">
                    <Phone
                      size={20}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500"
                    />

                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-4 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                      placeholder="Ej: +54 9 11 ..."
                    />
                  </div>
                </div>
              </div>

              <div className="group">
                <label className="mb-2.5 block text-sm font-black text-slate-700 transition group-focus-within:text-blue-600">
                  Dirección
                </label>

                <div className="relative">
                  <MapPin
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500"
                  />

                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-2xl border-2 border-slate-50 bg-slate-50/50 py-4 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/50"
                    placeholder="Calle, Ciudad..."
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2.5rem] border-2 border-slate-100 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">
                  Estado Operativo
                </h2>

                <p className="mt-2 max-w-2xl text-sm font-semibold leading-relaxed text-slate-500">
                  Al desactivar un cliente, este ya no podrá ser seleccionado en nuevos pedidos o presupuestos, 
                  pero sus datos históricos permanecerán intactos.
                </p>
              </div>

              <button
                type="button"
                onClick={toggleClientStatus}
                disabled={statusLoading}
                className={`inline-flex items-center justify-center gap-3 rounded-2xl px-6 py-4 text-sm font-black shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActive
                    ? 'bg-amber-50 text-amber-700 shadow-amber-900/5 hover:bg-amber-100'
                    : 'bg-emerald-50 text-emerald-700 shadow-emerald-900/5 hover:bg-emerald-100'
                }`}
              >
                {statusLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isActive ? (
                  <ToggleRight size={22} />
                ) : (
                  <ToggleLeft size={22} />
                )}

                {statusLoading
                  ? 'Actualizando...'
                  : isActive
                    ? 'Marcar como inactivo'
                    : 'Activar cliente'}
              </button>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-end">
            <Link
              href="/clientes"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-8 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              <ArrowLeft size={18} />
              Cancelar
            </Link>

            <button
              type="button"
              onClick={updateClient}
              disabled={loading}
              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-blue-600 px-10 py-4 text-sm font-black text-white shadow-xl shadow-blue-900/20 transition hover:bg-blue-700 hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Save size={20} />
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
      <span className="inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black text-white shadow-xl">
        <div className="h-2 w-2 rounded-full bg-slate-400" />
        Cliente Inactivo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center justify-center gap-3 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-xl">
      <div className="h-2 w-2 rounded-full bg-blue-300 animate-pulse" />
      Cliente Activo
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
    <div className="min-w-0 rounded-[2rem] border-2 border-slate-50 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
          <Icon size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black uppercase tracking-widest text-slate-400">
            {title}
          </p>

          <h2 className="mt-0.5 truncate text-lg font-black text-slate-900">
            {value}
          </h2>
        </div>
      </div>
    </div>
  )
}