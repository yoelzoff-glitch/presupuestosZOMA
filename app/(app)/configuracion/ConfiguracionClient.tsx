'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Settings,
  Users,
  CreditCard,
  CheckCircle2,
  XCircle,
  Loader2,
  Building2,
} from 'lucide-react'

import { supabase } from '@/lib/supabase/client'

type MpStatus = {
  connected: boolean
  account: {
    mp_user_id: string
    public_key: string
    connected: boolean
    updated_at: string
  } | null
}

type Props = {
  companyId: string
}

export default function ConfiguracionClient({ companyId }: Props) {
  const [mpStatus, setMpStatus] = useState<MpStatus | null>(null)
  const [loadingMp, setLoadingMp] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)

  useEffect(() => {
    loadMpStatus()
  }, [])

  async function loadMpStatus() {
    setLoadingMp(true)

    try {
      const response = await fetch(
        `/api/mercadopago/status?company_id=${companyId}`
      )

      const data = await response.json()

      setMpStatus(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoadingMp(false)
    }
  }

  function handleDisconnect() {
    if (!companyId) return
    setShowDisconnectModal(true)
  }

  async function executeDisconnect() {
    if (!companyId) return

    setShowDisconnectModal(false)

    try {
      setDisconnecting(true)

      const response = await fetch('/api/mercadopago/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: companyId,
        }),
      })

      if (!response.ok) {
        toast.error('No se pudo desconectar Mercado Pago')
        return
      }

      toast.success('Mercado Pago desconectado exitosamente')
      await loadMpStatus()
    } catch (error) {
      console.error(error)
      toast.error('Ocurrió un error al desconectar')
    } finally {
      setDisconnecting(false)
    }
  }

    async function handleConnectMercadoPago() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        const token = session?.access_token

        if (!token) {
          alert('Sesión inválida')
          return
        }

        const response = await fetch(
          '/api/mercadopago/oauth/start',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        const data = await response.json()

        if (!response.ok) {
          toast.error(data?.error || 'No se pudo iniciar Mercado Pago')
          return
        }

        if (!data?.auth_url) {
          toast.error('No se recibió la URL de Mercado Pago')
          return
        }

        window.location.href = data.auth_url
        
      } catch (error) {
        console.error(error)
        toast.error('Error conectando Mercado Pago')
      }
    }
    
  

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
          <Settings size={14} />
          Configuración
        </div>

        <h1 className="text-3xl font-black">
          Configuración del sistema
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Desde esta sección se pueden administrar los parámetros generales del sistema de presupuestos.
        </p>
      </section>

      {showDisconnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-2xl">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-600">
              <XCircle size={32} />
            </div>

            <h2 className="text-2xl font-black text-slate-900">
              Desconectar Mercado Pago
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              ¿Seguro que querés desconectar Mercado Pago? Dejarás de recibir pagos automáticos.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDisconnectModal(false)}
                className="rounded-2xl px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={executeDisconnect}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-900/20 transition hover:bg-red-500"
              >
                Sí, desconectar
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Empresa */}
        <Link
          href="/configuracion/empresa"
          className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Building2 size={22} />
            </div>
            <h2 className="text-lg font-black text-slate-900">
              Datos de la empresa
            </h2>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Nombre comercial, CUIT, dirección y datos que aparecen en los presupuestos.
          </p>

          <p className="mt-4 text-xs font-bold text-blue-600 opacity-0 transition group-hover:opacity-100">
            Ir a configuración →
          </p>
        </Link>

        {/* Parámetros */}
        <Link
          href="/configuracion/parametros"
          className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <CreditCard size={22} />
            </div>
            <h2 className="text-lg font-black text-slate-900">
              Parámetros comerciales
            </h2>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Impuestos, descuentos, formas de pago y condiciones generales.
          </p>

          <p className="mt-4 text-xs font-bold text-blue-600 opacity-0 transition group-hover:opacity-100">
            Configurar parámetros →
          </p>
        </Link>

        {/* Usuarios clientes */}
        <Link
          href="/configuracion/clientes"
          className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Users size={22} />
            </div>

            <h2 className="text-lg font-black text-slate-900">
              Usuarios clientes
            </h2>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Creá usuarios para que tus clientes vean tu lista de precios y realicen pedidos.
          </p>

          <p className="mt-4 text-xs font-bold text-blue-600 opacity-0 transition group-hover:opacity-100">
            Ir a gestión →
          </p>
        </Link>

        {/* Mercado Pago */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <CreditCard size={22} />
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-900">
                Mercado Pago
              </h2>

              <p className="text-sm text-slate-500">
                Cobros online y pagos automáticos.
              </p>
            </div>
          </div>

          {loadingMp ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Consultando estado...
            </div>
          ) : mpStatus?.connected ? (
            <>
              <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 size={18} />
                  <span className="font-bold">
                    Mercado Pago conectado
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-sm text-emerald-800">
                  <p>
                    <span className="font-semibold">
                      Usuario MP:
                    </span>{' '}
                    {mpStatus.account?.mp_user_id}
                  </p>

                  <p>
                    <span className="font-semibold">
                      Última actualización:
                    </span>{' '}
                    {new Date(
                      mpStatus.account?.updated_at || ''
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {disconnecting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <XCircle size={16} />
                )}

                Desconectar Mercado Pago
              </button>
            </>
          ) : (
            <>
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <XCircle size={18} />
                  <span className="font-bold">
                    Mercado Pago no conectado
                  </span>
                </div>

                <p className="mt-2 text-sm text-amber-800">
                  Vinculá una cuenta para recibir pagos online automáticamente.
                </p>
              </div>

              
              <button
                 onClick={handleConnectMercadoPago}
                 className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700"
               >
                <CreditCard size={16} />
                Vincular Mercado Pago
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}