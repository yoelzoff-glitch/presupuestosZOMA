'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from 'lucide-react'

type StatusResponse = {
  status?: string
  checkout_url?: string | null
  redirect_to?: string | null
  error?: string | null
}

export default function RegisterReturnPage() {
  const router = useRouter()
  const [status, setStatus] = useState('pending_authorization')
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let attempts = 0
    let timeout: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    async function poll() {
      attempts += 1
      try {
        const response = await fetch('/api/auth/register-trial/status', { cache: 'no-store' })
        const body = (await response.json()) as StatusResponse
        if (!response.ok) throw new Error(body.error || 'No pudimos consultar el estado.')
        if (cancelled) return
        setStatus(body.status || 'pending_authorization')
        setCheckoutUrl(body.checkout_url || null)
        setError(body.error || null)
        if (body.redirect_to) {
          router.replace(body.redirect_to)
          return
        }
      } catch (pollError) {
        if (!cancelled) setError(pollError instanceof Error ? pollError.message : 'Error inesperado.')
      }

      if (!cancelled && attempts < 40) timeout = setTimeout(poll, 3000)
    }

    void poll()
    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
    }
  }, [router])

  const failed = status === 'provisioning_failed' || status === 'cancelled'

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-5">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        {status === 'provisioned' ? (
          <CheckCircle2 className="mx-auto text-emerald-700" size={44} />
        ) : failed ? (
          <RefreshCw className="mx-auto text-amber-700" size={42} />
        ) : (
          <Loader2 className="mx-auto animate-spin text-emerald-700" size={44} />
        )}
        <h1 className="mt-5 text-2xl font-extrabold text-slate-950">
          {failed ? 'Necesitamos retomar la autorización' : 'Estamos creando tu empresa'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {error || 'Estamos validando Mercado Pago y preparando tu espacio de trabajo. Esta pantalla se actualiza sola.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {checkoutUrl && failed && (
            <a href={checkoutUrl} className="flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-bold text-white">
              Retomar checkout <ExternalLink size={16} />
            </a>
          )}
          <Link href="/auth/login" className="flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-bold text-slate-700">
            Ir al inicio de sesión
          </Link>
        </div>
      </section>
    </main>
  )
}
