import Link from 'next/link'
import { Sparkles, ArrowLeft, Mail, Clock, MessageSquare, ShieldAlert } from 'lucide-react'

export const metadata = {
  title: 'Contacto Técnico - ZOMA',
  description: 'Comunicate con el centro de ayuda de ZOMA. Soporte especializado para tu Pyme.',
}

export default function ContactoPage() {
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
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-300">
              <Sparkles size={20} />
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
                  <p className="text-slate-400 text-xs font-bold mt-1">Soporte prioritario 24/7 en Plan Ultra</p>
                </div>
              </div>

            </div>

            {/* Contact Form Column */}
            <div className="md:col-span-7">
              <div className="bg-gradient-to-br from-indigo-600/10 to-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 relative overflow-hidden">
                <h3 className="text-xl font-black text-white mb-6">Mandar una Consulta</h3>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nombre Completo</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Juan Pérez" 
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs outline-none text-slate-200 focus:border-indigo-500 transition font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email de Contacto</label>
                    <input 
                      type="email" 
                      placeholder="Ej: juan@miempresa.com" 
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs outline-none text-slate-200 focus:border-indigo-500 transition font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mensaje</label>
                    <textarea 
                      rows={4}
                      placeholder="¿En qué te podemos ayudar?" 
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs outline-none text-slate-200 focus:border-indigo-500 transition font-bold resize-none"
                    />
                  </div>

                  <button className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] py-4 text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-indigo-600/15 cursor-pointer">
                    Enviar Mensaje
                  </button>
                </div>
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
