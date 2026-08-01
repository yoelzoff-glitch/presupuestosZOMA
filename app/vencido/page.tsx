'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarClock,
  CreditCard,
  ExternalLink,
  Loader2,
  LogOut,
  MessageCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type BillingStatus = {
  status: string | null
  trial_ends_at: string | null
  next_charge_at: string | null
  cancel_at_period_end: boolean | null
  checkout_url: string | null
}

function dateLabel(value: string | null) {
  if (!value) return 'No disponible'
  return new Date(value).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function VencidoPage() {
  const router = useRouter()
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/billing/subscription', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('billing_unavailable')
        return response.json()
      })
      .then(setBilling)
      .catch(() => setBilling(null))
      .finally(() => setLoading(false))
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="text-xl font-extrabold tracking-tight">
            ZOMA <span className="text-emerald-700">ERP</span>
          </span>
          <button onClick={logout} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950">
            <LogOut size={17} /> Cerrar sesión
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-md bg-red-50 text-red-700">
            <CreditCard size={25} />
          </div>
          <p className="mt-6 text-sm font-bold text-red-700">Acceso operativo pausado</p>
          <h1 className="mt-1 text-3xl font-extrabold">Necesitamos regularizar tu suscripción</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
            Tu información permanece segura. Para volver a presupuestar, facturar y gestionar el negocio, revisa el medio de pago asociado en Mercado Pago.
          </p>

          {loading ? (
            <div className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Loader2 className="animate-spin" size={18} /> Consultando la suscripción...
            </div>
          ) : (
            <div className="mt-7 flex flex-wrap gap-3">
              {billing?.checkout_url && (
                <a href={billing.checkout_url} className="flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800">
                  Abrir Mercado Pago <ExternalLink size={17} />
                </a>
              )}
              <Link href="https://wa.me/5491132123456" target="_blank" className="flex h-11 items-center gap-2 rounded-md border border-slate-300 px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <MessageCircle size={17} /> Contactar soporte
              </Link>
            </div>
          )}
        </section>

        <aside className="h-fit rounded-lg border border-slate-800 bg-slate-950 p-6 text-white">
          <p className="text-xs font-bold uppercase text-emerald-400">Estado de facturación</p>
          <p className="mt-2 text-xl font-extrabold">{billing?.status || 'No disponible'}</p>
          <div className="mt-6 grid gap-4 border-t border-slate-800 pt-5 text-sm">
            <div className="flex gap-3">
              <CalendarClock className="shrink-0 text-slate-400" size={18} />
              <div>
                <p className="font-bold">Fin de prueba</p>
                <p className="text-slate-400">{dateLabel(billing?.trial_ends_at || null)}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <CreditCard className="shrink-0 text-slate-400" size={18} />
              <div>
                <p className="font-bold">Próximo cobro</p>
                <p className="text-slate-400">{dateLabel(billing?.next_charge_at || null)}</p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-slate-400">
            Después de actualizar el pago, Mercado Pago notificará a ZOMA y el acceso se restablecerá automáticamente.
          </p>
        </aside>
      </div>
    </main>
  )
}
