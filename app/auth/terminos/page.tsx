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

          <div className="mb-6 text-sm font-medium text-slate-600 leading-relaxed">
            <p className="mb-4">
              Bienvenido a <strong>presupuestosZOMA</strong> (en adelante, la "Plataforma"), producto desarrollado y operado por <strong>ZOMAsolutions</strong> (en adelante, la "Empresa"). Al acceder o utilizar la aplicación web, sus servicios y herramientas, usted (en adelante, el "Usuario") acepta estar sujeto a los siguientes Términos y Condiciones. Si no está de acuerdo con alguno de estos términos, le solicitamos que no utilice la Plataforma.
            </p>
          </div>

          <h2 className="text-xl font-black text-slate-900 mb-4">1. Objeto del Servicio</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-2">
            presupuestosZOMA es una plataforma de gestión comercial diseñada para facilitar la administración de ventas, incluyendo de manera enunciativa pero no limitativa:
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 font-medium mb-6">
            <li>La creación, envío y gestión de presupuestos.</li>
            <li>La generación y seguimiento de pedidos.</li>
            <li>El control de cuentas corrientes y deudas de clientes.</li>
            <li>La gestión de catálogos de productos y precios.</li>
            <li>El procesamiento de pagos a través de integraciones con terceros (pasarelas de pago).</li>
          </ul>

          <h2 className="text-xl font-black text-slate-900 mb-4">2. Registro y Cuentas</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-2">
            Para utilizar ciertas funciones, el Usuario debe registrarse y crear una cuenta, ya sea como Empresa, Vendedor o Cliente. 
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 font-medium mb-6">
            <li>Usted es responsable de mantener la confidencialidad de sus credenciales de acceso.</li>
            <li>Toda actividad realizada bajo su cuenta es su exclusiva responsabilidad.</li>
            <li>Se compromete a proporcionar información veraz, exacta y actualizada durante el registro y el uso del sistema.</li>
          </ul>

          <h2 className="text-xl font-black text-slate-900 mb-4">3. Sistema de Pagos en Línea</h2>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6">
            <p className="text-sm font-medium text-blue-900 leading-relaxed mb-4">
              La Plataforma permite a los Usuarios realizar pagos de facturas, deudas u órdenes a través de integraciones con proveedores de servicios de pago externos (por ejemplo, Mercado Pago).
            </p>
            <ul className="list-disc list-inside text-xs text-blue-800 space-y-3 font-bold">
              <li><span className="font-black underline">Pasarelas de Terceros:</span> ZOMAsolutions actúa únicamente como intermediario tecnológico que facilita la conexión entre el Usuario y la pasarela de pagos a través de presupuestosZOMA. El procesamiento del pago se rige por los términos y condiciones del proveedor de pago correspondiente.</li>
              <li><span className="font-black underline">Exención de Responsabilidad:</span> La Plataforma no almacena datos de tarjetas de crédito ni credenciales bancarias sensibles. ZOMAsolutions no es responsable por fallas, interrupciones, demoras o denegaciones de transacciones realizadas a través de los proveedores externos.</li>
              <li><span className="font-black underline">Confirmación de Pago:</span> El reflejo del pago en la cuenta corriente del sistema depende de la confirmación enviada por la API de la pasarela de pagos. Cualquier reclamo sobre el procesamiento de los fondos deberá ser dirigido al emisor de la tarjeta o al proveedor de la pasarela de pagos.</li>
            </ul>
          </div>

          <h2 className="text-xl font-black text-slate-900 mb-4">4. Gestión de Datos y Privacidad</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-2">
            El uso de la Plataforma implica el tratamiento de datos comerciales, de productos y de clientes.
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 font-medium mb-6">
            <li><strong>Propiedad de los Datos:</strong> Los datos ingresados por las empresas y vendedores pertenecen a los mismos. ZOMAsolutions se reserva el derecho de utilizar datos anónimos y agregados para mejorar el servicio.</li>
            <li><strong>Seguridad:</strong> ZOMAsolutions aplica medidas de seguridad estándar de la industria para proteger la información, aunque el Usuario reconoce que ningún sistema de transmisión de datos por Internet es 100% seguro.</li>
          </ul>

          <h2 className="text-xl font-black text-slate-900 mb-4">5. Responsabilidad sobre Presupuestos y Pedidos</h2>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 font-medium mb-6">
            <li>La generación de un presupuesto no constituye necesariamente un contrato de venta final hasta que no sea debidamente confirmado por las partes según sus propias políticas comerciales.</li>
            <li>La exactitud de los precios, stock y descripciones de productos es responsabilidad exclusiva de la Empresa o Vendedor que carga dicha información en el sistema.</li>
          </ul>

          <h2 className="text-xl font-black text-slate-900 mb-4">6. Usos Prohibidos</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-2">
            El Usuario se compromete a no:
          </p>
          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 font-medium mb-6">
            <li>Utilizar la Plataforma para fines ilícitos o fraudulentos.</li>
            <li>Interferir o intentar vulnerar la seguridad, servidores o redes de la Plataforma.</li>
            <li>Realizar ingeniería inversa o copiar el código fuente de la aplicación.</li>
          </ul>

          <h2 className="text-xl font-black text-slate-900 mb-4">7. Modificaciones del Servicio y de los Términos</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
            ZOMAsolutions se reserva el derecho de modificar, suspender o interrumpir el servicio (o cualquier parte del mismo) en cualquier momento con o sin previo aviso. Asimismo, ZOMAsolutions puede actualizar estos Términos y Condiciones. El uso continuado de la Plataforma después de dichas modificaciones constituirá la aceptación de los nuevos términos.
          </p>

          <h2 className="text-xl font-black text-slate-900 mb-4">8. Limitación de Responsabilidad</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6">
            En la medida máxima permitida por la ley, ZOMAsolutions no será responsable por daños indirectos, incidentales, especiales o consecuentes, incluyendo lucro cesante, pérdida de datos o interrupciones de negocios derivados del uso o la imposibilidad de usar la Plataforma.
          </p>

          <h2 className="text-xl font-black text-slate-900 mb-4">9. Jurisdicción y Ley Aplicable</h2>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-8 border-b pb-4">
            Estos Términos y Condiciones se rigen por las leyes locales aplicables. Cualquier controversia derivada del presente será sometida a los tribunales competentes.
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
