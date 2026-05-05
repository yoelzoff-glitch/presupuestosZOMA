import { Settings } from 'lucide-react'

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
          Desde esta sección se van a poder administrar los parámetros generales
          del sistema de presupuestos.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">
            Datos de la empresa
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Nombre comercial, CUIT, dirección y datos que después aparecen en los presupuestos.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900">
            Parámetros comerciales
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Impuestos, descuentos, formas de pago y condiciones generales.
          </p>
        </div>
      </section>
    </div>
  )
}