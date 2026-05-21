'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowLeft, Mail, Clock, MessageSquare, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

export default function ContactoPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setError('Por favor, completa todos los campos del formulario.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/contacto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess(true)
        setFormData({ name: '', email: '', message: '' })
      } else {
        throw new Error(data.error || 'Ocurrió un error al enviar tu consulta.')
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión. Por favor intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 overflow-x-hidden text-slate-200 selection:bg-indigo-600 selection:text-white font-sans antialiased">
      
      {/* BACKGROUND GRADIENTS */}
      <div className="absolute top-0 left-0 w-full h-[800px] opacity-[0.25] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[700px] bg-gradient-to-br from-indigo-700/60 to-violet-800/10 blur-[130px] rounded-full" />
        <div className="absolute top-[10%] right-[-10%] w-[60%] h-[600px] bg-gradient-to-bl from-blue-700/50 to-indigo-900/15 blur-[120px] rounded-full" />
      </div>

      {/* NAVBAR */}
      <nav className="fixed top-0 z-[100] w-full bg-slate-950/75 backdrop-blur-2xl border-b border-slate-900 transition-all duration-300">
        <div className="container mx-auto flex h-22 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-[#001333] border border-slate-800 shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-300">
              <img 
                src="/logo-zoma.jpg" 
                alt="ZOMA Logo" 
                className="h-full w-full object-cover scale-[1.45] -translate-y-[8%]" 
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-white leading-none">ZOMA</span>
              <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase">Gestión de Ventas</span>
            </div>
          </Link>
          
          <Link 
            href="/" 
            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition duration-200"
          >
            <ArrowLeft size={14} /> Volver al Inicio
          </Link>
        </div>
      </nav>

      {/* CONTENT */}
      <main className="flex-grow pt-36 pb-24 relative z-10">
        <div className="container mx-auto px-6 max-w-4xl">
          
          {/* Header Title */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4.5 py-1.5 text-[10px] font-black uppercase tracking-widest mb-6">
              Soporte al Cliente
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              ¿Cómo podemos ayudarte?
            </h1>
            <p className="text-slate-400 max-w-xl mx-auto mt-4 text-sm font-medium leading-relaxed">
              Estamos en línea para responder tus inquietudes impositivas, de calibración, de planes o cualquier duda del sistema.
            </p>
          </div>

          <div className="grid md:grid-cols-12 gap-8 items-stretch">
            
            {/* Info Cards Column */}
            <div className="md:col-span-5 space-y-6 flex flex-col justify-between">
              
              <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl space-y-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Correo Electrónico</h3>
                  <p className="text-slate-400 text-xs font-bold mt-1">soporte@zoma.com.ar</p>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl space-y-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Horario de Soporte</h3>
                  <p className="text-slate-400 text-xs font-bold mt-1">Lunes a Viernes · 9:00 a 18:00 hs</p>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-3xl space-y-4">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Mesa de Ayuda</h3>
                  <p className="text-slate-400 text-xs font-bold mt-1">Soporte prioritario 24/7 en Plan PRO</p>
                </div>
              </div>

            </div>

            {/* Contact Form Column */}
            <div className="md:col-span-7">
              <div className="bg-gradient-to-br from-indigo-600/10 to-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 relative overflow-hidden">
                <h3 className="text-xl font-black text-white mb-6">Mandar una Consulta</h3>
                
                {success ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="mx-auto h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/5">
                      <CheckCircle2 size={32} className="animate-bounce" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-black text-white">¡Mensaje Enviado con Éxito!</h4>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
                        Tu consulta fue registrada en el sistema y se ha notificado a nuestro equipo a través de <span className="text-indigo-400 font-bold">soporte@zoma.com.ar</span>. Nos comunicaremos con vos a la brevedad.
                      </p>
                    </div>
                    <button 
                      onClick={() => setSuccess(false)}
                      className="mt-4 px-6 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-300 rounded-xl transition duration-200 cursor-pointer"
                    >
                      Enviar otra consulta
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 p-4.5 rounded-2xl text-[11px] leading-relaxed">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span className="font-bold">{error}</span>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nombre Completo</label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ej: Juan Pérez" 
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs outline-none text-slate-200 focus:border-indigo-500 transition font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email de Contacto</label>
                      <input 
                        type="email" 
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="Ej: juan@miempresa.com" 
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs outline-none text-slate-200 focus:border-indigo-500 transition font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mensaje</label>
                      <textarea 
                        rows={4}
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="¿En qué te podemos ayudar?" 
                        className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs outline-none text-slate-200 focus:border-indigo-500 transition font-bold resize-none"
                      />
                    </div>

                    <button 
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] py-4 text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-indigo-600/15 cursor-pointer disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Enviando Consulta...</span>
                        </>
                      ) : (
                        <span>Enviar Mensaje</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8 relative z-10">
        <div className="container mx-auto px-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
          <p>© {new Date().getFullYear()} ZOMA Hub. Creado para impulsar el comercio argentino ❤️</p>
        </div>
      </footer>

    </div>
  )
}
