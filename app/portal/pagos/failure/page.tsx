import Link from 'next/link'
import { XCircle } from 'lucide-react'

export default function PagoFailurePage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border text-center">
        <XCircle className="mx-auto mb-4 h-14 w-14 text-red-500" />

        <h1 className="text-2xl font-bold text-slate-900">
          El pago no se pudo completar
        </h1>

        <p className="mt-3 text-slate-600">
          No se acreditó ningún pago. Podés volver al portal e intentarlo nuevamente.
        </p>

        <Link
          href="/portal"
          className="mt-6 inline-flex w-full justify-center rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Volver al portal
        </Link>
      </div>
    </main>
  )
}