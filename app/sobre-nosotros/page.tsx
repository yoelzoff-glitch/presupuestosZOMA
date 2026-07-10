import Link from 'next/link'
import { Sparkles, ArrowLeft, Building2, Users2, Target, Heart } from 'lucide-react'

export const metadata = {
  title: 'Sobre Nosotros - ZOMA',
  description: 'Conocé la historia y el propósito de ZOMA, el sistema diseñado para impulsar el comercio argentino.',
}

export default function SobreNosotrosPage() {
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
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4.5 py-1.5 text-[10px] font-black uppercase tracking-widest mb-6">
              Nuestra Historia
            </span>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
              Diseñado por y para <br/> el comercio argentino.
            </h1>
            <p className="text-slate-400 max-w-2xl mx-auto mt-6 text-base md:text-lg font-medium leading-relaxed">
              ZOMA nació con una meta simple: hacer que la administración de ventas de las pequeñas y medianas empresas argentinas deje de ser un dolor de cabeza diario.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            
            <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-[2rem] space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Building2 size={22} />
              </div>
              <h3 className="text-xl font-black text-white">¿Quiénes Somos?</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Somos un equipo apasionado de profesionales de la tecnología y las finanzas. Nos unimos para crear una solución adaptada a las reglas fiscales, de remitos e impuestos de nuestro país, resolviendo de verdad las trabas de cada día.
              </p>
            </div>

            <div className="bg-slate-900/40 border border-slate-900 p-8 rounded-[2rem] space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <Target size={22} />
              </div>
              <h3 className="text-xl font-black text-white">Nuestro Propósito</h3>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Darle a las Pymes las mismas herramientas tecnológicas de control que tienen las grandes corporaciones, pero con una interfaz intuitiva, accesible y de rápida implementación que no requiere conocimientos técnicos.
              </p>
            </div>

          </div>

          {/* Core values block */}
          <div className="bg-gradient-to-br from-indigo-600/10 to-slate-900/40 border border-slate-800 rounded-[3rem] p-10 md:p-14 relative overflow-hidden">
            <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 bg-indigo-500 text-slate-950 font-black uppercase text-[9px] tracking-widest px-3.5 py-1.5 rounded-xl">
              Nuestros Valores
            </div>
            
            <div className="space-y-8">
              <div className="flex items-start gap-5">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                  <Users2 size={18} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white">Cercanía y Empatía</h4>
                  <p className="text-sm text-slate-400 mt-1 font-medium">Entendemos lo difícil que es llevar adelante un negocio en Argentina. Por eso, nuestro soporte es directo y siempre humano.</p>
                </div>
              </div>

              <div className="flex items-start gap-5">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                  <Heart size={18} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white">Simplicidad como Estándar</h4>
                  <p className="text-sm text-slate-400 mt-1 font-medium">Creemos que el software excelente no necesita ser complicado. Diseñamos para que cualquier empleado o vendedor aprenda a usar el sistema en 5 minutos.</p>
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
