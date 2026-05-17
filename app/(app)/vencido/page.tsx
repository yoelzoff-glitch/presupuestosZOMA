'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Clock, CreditCard, MessageCircle, LogOut, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function VencidoPage() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 p-10 text-center border border-slate-100"
      >
        <div className="h-20 w-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Clock size={40} className="animate-pulse" />
        </div>

        <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">
          Tu suscripción ha vencido
        </h1>
        
        <p className="text-slate-500 font-medium leading-relaxed mb-10">
          Tu acceso a ZOMA está temporalmente suspendido. Para continuar gestionando tu negocio, necesitas renovar tu plan o contactar a soporte.
        </p>

        <div className="space-y-4">
          <button 
            disabled
            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all opacity-50 cursor-not-allowed"
          >
            Renovar con Mercado Pago
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full uppercase">Próximamente</span>
          </button>

          <Link 
            href="https://wa.me/5491132123456" // Reemplazar por tu WhatsApp real
            target="_blank"
            className="w-full flex items-center justify-center gap-3 bg-emerald-50 text-emerald-700 py-4 rounded-2xl font-black hover:bg-emerald-100 transition-all"
          >
            <MessageCircle size={20} />
            Contactar a Soporte
          </Link>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-3 text-slate-400 py-4 rounded-2xl font-bold hover:text-slate-600 transition-all"
          >
            <LogOut size={18} />
            Cerrar Sesión
          </button>
        </div>

        <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400">
          <AlertCircle size={14} />
          <p className="text-xs font-bold uppercase tracking-widest">ZOMA Security Protocol</p>
        </div>
      </motion.div>
    </div>
  )
}
