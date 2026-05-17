import Link from 'next/link'
import { Sparkles, ArrowLeft, ShieldCheck, Lock } from 'lucide-react'

export const metadata = {
  title: 'Políticas de Privacidad - ZOMA',
  description: 'Conocé cómo protegemos tus datos comerciales y de ventas en ZOMA.',
}

export default function PrivacidadPage() {
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

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
              Privacidad y Seguridad
            </span>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              Políticas de Privacidad
            </h1>
            <p className="text-slate-400 mt-4 text-xs font-bold uppercase tracking-wider">
              Última actualización: {fecha}
            </p>
          </div>

          {/* Legal Text Panel */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-[2.5rem] p-8 md:p-12 space-y-8 text-slate-300 text-sm font-medium leading-relaxed">
            
            <section className="space-y-3">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Lock size={18} className="text-indigo-400" />
                1. Tratamiento de tus datos comerciales
              </h2>
              <p>
                En ZOMA entendemos que tu facturación, stock y lista de clientes son el corazón de tu negocio. Toda la información comercial cargada en tu cuenta es de tu absoluta propiedad. ZOMA jamás venderá ni distribuirá tus datos de ventas a terceros.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-indigo-400" />
                2. Seguridad y Encriptación
              </h2>
              <p>
                Tus credenciales impositivas de AFIP (archivos .crt y .key) y las contraseñas de acceso al sistema se almacenan de manera encriptada y bajo medidas estrictas de ciberseguridad, asegurando un canal de conexión infranqueable y privado.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Lock size={18} className="text-indigo-400" />
                3. Alertas y Seguimiento
              </h2>
              <p>
                El aviso de lectura de presupuestos recopila marcas temporales e información de red básica para notificar al emisor en qué momento exacto fue abierto el presupuesto, previniendo usos malintencionados y optimizando el ciclo comercial.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <ShieldCheck size={18} className="text-indigo-400" />
                4. Control del Usuario
              </h2>
              <p>
                Tenés total control para editar o dar de baja presupuestos, productos o información de tus vendedores cuando lo consideres oportuno. Los backups automatizados de ZOMA resguardan la continuidad operativa de tus registros 24/7.
              </p>
            </section>

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
