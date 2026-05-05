import Link from 'next/link'
import { Settings, Users } from 'lucide-react'

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-200">
          <Settings size={14} />
          Configuración
        </div>

        <h1 className="text-3xl font-black">Configuración del sistema</h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          Desde esta sección se pueden administrar los parámetros generales del sistema de presupuestos.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Empresa */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">
            Datos de la empresa
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Nombre comercial, CUIT, dirección y datos que aparecen en los presupuestos.
          </p>
        </div>

        {/* Parámetros */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">
            Parámetros comerciales
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Impuestos, descuentos, formas de pago y condiciones generales.
          </p>
        </div>

        {/* NUEVO: Usuarios clientes */}
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
      </section>
    </div>
  )
}