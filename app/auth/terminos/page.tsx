'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ShieldAlert, CheckCircle, LogOut, FileText, ScrollText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CURRENT_TERMS_VERSION } from '@/lib/constants'

export default function TerminosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/auth/login')
      } else {
        setUserId(data.user.id)
      }
      setChecking(false)
    }
    checkSession()
  }, [router])

  async function handleAccept() {
    if (!userId) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('users_profiles')
        .update({ accepted_terms_version: CURRENT_TERMS_VERSION })
        .eq('id', userId)

      if (error) throw error

      toast.success('Términos aceptados correctamente.')
      
      // Pequeño delay para asegurar escritura y luego refresh total
      setTimeout(() => {
        window.location.href = '/'
      }, 800)
      
    } catch (err: any) {
      toast.error(err.message || 'Ocurrió un error al procesar la solicitud.')
      setLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (err) {
      window.location.href = '/auth/login'
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    )
  }

  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 md:px-8 flex items-center justify-center selection:bg-blue-100 selection:text-blue-900">
      <div className="w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="bg-slate-950 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[80px] rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-cyan-500/10 blur-[60px] rounded-full -ml-20 -mb-20"></div>
          
          <div className="relative z-10 flex flex-col items-center text-center sm:flex-row sm:text-left sm:items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <ShieldAlert size={32} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Acuerdo de Servicio</h1>
              <p className="text-blue-200 text-sm mt-1 font-medium">Es necesario aceptar las bases legales para continuar.</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-6 md:p-10 overflow-y-auto max-h-[60vh] bg-white prose prose-slate max-w-none custom-scrollbar border-b border-slate-100">
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-4">
            <FileText size={14} /> Última actualización: {fecha}
          </div>

          <h2 className="text-xl font-black text-slate-900 mb-4">1. Objeto del Servicio</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
            Presupuestos ZOMA es una plataforma de gestión comercial diseñada para facilitar la administración de ventas, incluyendo de manera enunciativa pero no limitativa:
            la creación y envío de presupuestos, el seguimiento de pedidos, el control de cuentas corrientes de clientes, la gestión de catálogos de precios y el procesamiento de cobros en línea.
          </p>

          <h2 className="text-xl font-black text-slate-900 mb-4">2. Registro y Seguridad</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
            El Usuario se compromete a mantener la confidencialidad de sus credenciales. Toda actividad realizada bajo su cuenta es responsabilidad exclusiva del titular. Debe proporcionar información veraz durante el uso del sistema.
          </p>

          <h2 className="text-xl font-black text-slate-900 mb-4">3. Pagos en Línea e Intermediación</h2>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6">
            <p className="text-sm font-bold text-blue-800 leading-relaxed mb-3">
              La Plataforma actúa únicamente como un conector tecnológico con pasarelas de pago de terceros (como Mercado Pago).
            </p>
            <ul className="list-disc list-inside text-xs text-blue-700 space-y-2 font-medium">
              <li>No almacenamos datos de tarjetas de crédito sensibles.</li>
              <li>Cualquier falla en el procesamiento de fondos es responsabilidad exclusiva del proveedor externo de pagos.</li>
              <li>El registro del cobro en el sistema depende 100% de la confirmación exitosa vía API de la pasarela externa.</li>
            </ul>
          </div>

          <h2 className="text-xl font-black text-slate-900 mb-4">4. Privacidad y Propiedad de Datos</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
            Los datos ingresados pertenecen a sus respectivos propietarios (Empresas o Clientes). Presupuestos ZOMA aplica estándares de cifrado modernos para protegerlos, pero el Usuario entiende los riesgos inherentes a Internet.
          </p>

          <h2 className="text-xl font-black text-slate-900 mb-4">5. Responsabilidad de Transacciones</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
            Un presupuesto generado no constituye obligatoriedad contractual de entrega hasta ser formalmente aprobado. La veracidad de los stocks, precios y descripciones corre por cuenta del Vendedor o Administrador que los cargó.
          </p>

          <h2 className="text-xl font-black text-slate-900 mb-4">6. Limitaciones</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
            Nos reservamos el derecho a discontinuar el servicio por mantenimiento con aviso previo y a actualizar los Términos y Condiciones. En la máxima medida posible por ley, se exime de responsabilidad por lucros cesantes o pérdidas derivadas de cortes no programados.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-6 md:p-8 flex flex-col sm:flex-row-reverse items-center justify-between gap-4 border-t border-slate-200">
          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-10 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-900/10 hover:-translate-y-0.5 transition-all active:scale-95"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
            {loading ? 'Procesando...' : 'Aceptar y Continuar'}
          </button>

          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-50"
          >
            <LogOut size={18} />
            No aceptar / Salir
          </button>
        </div>

      </div>
    </div>
  )
}
