'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Clock, 
  CreditCard, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Calendar,
  MessageCircle,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
}

export default function SuscripcionPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function loadSubscription() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: perfil } = await supabase
          .from('users_profiles')
          .select('company:companies(subscription_expiry, plan_type, subscription_status)')
          .eq('id', user.id)
          .single()
        
        setData((perfil as any)?.company)
      }
      setLoading(false)
    }
    loadSubscription()
  }, [])

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-10 w-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  const hoy = new Date()
  const vencimiento = new Date(data?.subscription_expiry)
  const diferencia = vencimiento.getTime() - hoy.getTime()
  const diasRestantes = Math.ceil(diferencia / (1000 * 60 * 60 * 24))

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header Section */}
      <motion.div {...fadeInUp} className="bg-slate-950 rounded-[3rem] p-10 md:p-16 text-white relative overflow-hidden">
        <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600/20 border border-blue-600/30 text-blue-400 text-xs font-black uppercase tracking-widest mb-6">
              <Sparkles size={14} />
              Plan {data?.plan_type?.toUpperCase() || 'BASE'}
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6">Gestioná tu <br/> crecimiento.</h1>
            <p className="text-slate-400 font-medium text-lg leading-relaxed mb-8">
              Tu suscripción te permite acceder a todas las herramientas de ZOMA para potenciar tu negocio.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-[2.5rem] p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${diasRestantes <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                <Clock size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Estado de Cuenta</p>
                <p className="text-xl font-bold">
                  {diasRestantes <= 0 ? 'Suscripción Vencida' : `Quedan ${diasRestantes} días`}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-4 border-b border-white/5">
                <span className="text-slate-400 text-sm font-medium">Próximo vencimiento</span>
                <span className="font-bold">{vencimiento.toLocaleDateString('es-AR')}</span>
              </div>
              <div className="flex justify-between items-center py-4 border-b border-white/5">
                <span className="text-slate-400 text-sm font-medium">Método de pago</span>
                <span className="font-bold flex items-center gap-2">
                  <CreditCard size={16} /> Mercado Pago
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background Decorative */}
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/20 blur-[120px] rounded-full" />
      </motion.div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Contact support */}
        <motion.div {...fadeInUp} transition={{ delay: 0.1 }} className="md:col-span-2 bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
          <h2 className="text-2xl font-black text-slate-900 mb-6">¿Necesitás renovar ahora?</h2>
          <p className="text-slate-500 font-medium mb-10">
            Todavía estamos automatizando los cobros directos. Por el momento, la renovación se realiza enviando el comprobante de transferencia o link de pago a nuestro soporte técnico.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Link 
              href="https://wa.me/5491132123456" 
              target="_blank"
              className="flex items-center justify-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
            >
              <MessageCircle size={20} />
              Hablar con Soporte
            </Link>
            <Link 
              href="/dashboard"
              className="flex items-center justify-center gap-3 bg-slate-100 text-slate-600 px-8 py-4 rounded-2xl font-black hover:bg-slate-200 transition-all"
            >
              Volver al Dashboard
            </Link>
          </div>
        </motion.div>

        {/* Plan Features Mini List */}
        <motion.div {...fadeInUp} transition={{ delay: 0.2 }} className="bg-blue-600 rounded-[2.5rem] p-10 text-white flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-black mb-6">Tu Plan incluye:</h3>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-bold text-blue-100">
                <CheckCircle2 size={18} className="text-white" /> Presupuestos Ilimitados
              </li>
              <li className="flex items-center gap-3 text-sm font-bold text-blue-100">
                <CheckCircle2 size={18} className="text-white" /> Gestión de Clientes
              </li>
              <li className="flex items-center gap-3 text-sm font-bold text-blue-100">
                <CheckCircle2 size={18} className="text-white" /> Reportes de Ventas
              </li>
              <li className="flex items-center gap-3 text-sm font-bold text-blue-100">
                <CheckCircle2 size={18} className="text-white" /> Soporte prioritario
              </li>
            </ul>
          </div>
          
          <div className="mt-10 pt-6 border-t border-white/20">
             <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-200 mb-2">Seguridad</p>
             <div className="flex items-center gap-2 text-[10px] font-black text-white/70">
                <ShieldCheck size={14} /> DATOS ENCRIPTADOS
             </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
