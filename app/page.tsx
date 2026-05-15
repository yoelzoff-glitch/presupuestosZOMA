'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  BarChart3, 
  MessageSquare,
  Package,
  Wallet,
  Globe,
  Rocket,
  Clock,
  TrendingUp,
  Cpu,
  ChevronRight
} from 'lucide-react'

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
} as const

const stagger = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.1
    }
  },
  viewport: { once: true }
} as const

export default function LandingPage() {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -50])

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen bg-white overflow-x-hidden text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      
      {/* --- NAVIGATION --- */}
      <nav className="fixed top-0 z-[100] w-full bg-white/70 backdrop-blur-2xl border-b border-slate-100">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
              <Sparkles size={18} />
            </div>
            <span className="text-xl font-black tracking-tight">ZOMA</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-10 text-[13px] font-black uppercase tracking-widest text-slate-400">
            <Link href="#features" className="hover:text-blue-600 transition">Funciones</Link>
            <Link href="#pricing" className="hover:text-blue-600 transition">Precios</Link>
            <Link href="/auth/login" className="hover:text-blue-600 transition">Ingresar</Link>
          </div>

          <Link 
            href="/auth/register" 
            className="rounded-full bg-slate-950 px-7 py-2.5 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-600 transition-all duration-300 shadow-xl shadow-slate-950/10"
          >
            Empezar ahora
          </Link>
        </div>
      </nav>

      <main>
        {/* --- HERO SECTION (Light) --- */}
        <section className="relative pt-40 pb-24 lg:pt-56 lg:pb-40 bg-white">
          <div className="container mx-auto px-6">
            <motion.div style={{ y: heroY }} className="max-w-4xl mx-auto text-center mb-20">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 border border-blue-100 mb-10"
              >
                <Rocket size={14} className="text-blue-500" />
                Vende más, gestiona menos
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-6xl md:text-8xl font-black tracking-tight text-slate-950 mb-10 leading-[1.05]"
              >
                El sistema que <br/> impulsa tu <span className="text-blue-600">negocio.</span>
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto mb-14 leading-relaxed"
              >
                ZOMA centraliza tus presupuestos, stock y cuentas corrientes en una plataforma diseñada para la velocidad y la elegancia.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-5"
              >
                <Link 
                  href="/auth/register" 
                  className="w-full sm:w-auto rounded-2xl bg-blue-600 px-12 py-5 text-lg font-black text-white hover:bg-blue-700 transition-all shadow-2xl shadow-blue-600/20"
                >
                  Probar 14 días gratis
                </Link>
                <Link 
                  href="#demo" 
                  className="w-full sm:w-auto rounded-2xl bg-white border border-slate-200 px-12 py-5 text-lg font-black text-slate-900 hover:bg-slate-50 transition"
                >
                  Ver Video Demo
                </Link>
              </motion.div>
            </motion.div>

            {/* Hero Showcase Image */}
            <motion.div 
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="relative max-w-6xl mx-auto"
            >
              <div className="relative rounded-[2rem] md:rounded-[3.5rem] border border-slate-200 bg-white p-3 shadow-[0_50px_100px_-30px_rgba(15,23,42,0.15)] overflow-hidden">
                <div className="rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border border-slate-100">
                  <Image 
                    src="/dashboard-mockup.png" 
                    alt="Zoma Dashboard" 
                    width={1400} 
                    height={800} 
                    className="w-full h-auto"
                  />
                </div>
              </div>
              
              {/* Floating Decorative Elements */}
              <motion.div 
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-12 -right-12 hidden lg:block z-20 pointer-events-none"
              >
                <Image src="/hero-3d.png" alt="3D" width={240} height={240} className="drop-shadow-2xl" />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* --- TRUST STATS (Subtle Gray) --- */}
        <section className="py-24 bg-slate-50 border-y border-slate-100">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12 items-center text-center">
              <StatBlock label="Presupuestos Enviados" value="+450k" />
              <StatBlock label="Empresas Activas" value="+1.200" />
              <StatBlock label="Uptime Garantizado" value="99.9%" />
              <StatBlock label="Ahorro de Tiempo" value="20h/semana" />
            </div>
          </div>
        </section>

        {/* --- BENTO FEATURES (High Impact) --- */}
        <section id="features" className="py-40 bg-white">
          <div className="container mx-auto px-6">
            <motion.div {...fadeInUp} className="text-center mb-24">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-blue-600 mb-6">Poder Sin Límites</h2>
              <p className="text-4xl md:text-6xl font-black tracking-tight text-slate-950">Todo lo que necesitás <br/> para escalar rápido.</p>
            </motion.div>

            <div className="grid md:grid-cols-12 gap-8 auto-rows-[350px]">
              {/* Feature 1: Large Bento */}
              <motion.div 
                {...fadeInUp}
                className="md:col-span-8 rounded-[3rem] bg-slate-950 p-12 text-white relative overflow-hidden group"
              >
                <div className="relative z-10 max-w-md">
                   <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center mb-8 shadow-lg shadow-blue-600/30">
                      <BarChart3 size={24} />
                   </div>
                   <h3 className="text-3xl font-black mb-4">Presupuestos que Venden</h3>
                   <p className="text-slate-400 font-medium text-lg leading-relaxed mb-8">
                     Envía propuestas profesionales en segundos. Tus clientes pueden ver, aceptar y pagar desde cualquier dispositivo.
                   </p>
                   <Link href="#" className="inline-flex items-center gap-2 text-blue-400 font-black text-sm uppercase tracking-widest hover:text-white transition">
                      Saber más <ChevronRight size={18} />
                   </Link>
                </div>
                <div className="absolute right-0 bottom-0 w-[50%] h-full opacity-60 group-hover:scale-105 transition-transform duration-700 pointer-events-none">
                   <Image 
                     src="/growth-icon-dark.png" 
                     alt="Growth" 
                     fill 
                     className="object-contain object-right-bottom mix-blend-screen"
                   />
                </div>
              </motion.div>

              {/* Feature 2: Small Bento */}
              <motion.div 
                {...fadeInUp}
                transition={{ delay: 0.1 }}
                className="md:col-span-4 rounded-[3rem] bg-blue-600 p-12 text-white relative overflow-hidden"
              >
                <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-8">
                    <Package size={24} />
                </div>
                <h3 className="text-2xl font-black mb-4">Stock Inteligente</h3>
                <p className="text-blue-100 font-medium">
                  Control total de inventario y recetas. Sincronización automática con tus ventas.
                </p>
                <div className="absolute bottom-[-10%] right-[-10%] w-32 h-32 bg-white/10 blur-3xl rounded-full" />
              </motion.div>

              {/* Feature 3: Small Bento */}
              <motion.div 
                {...fadeInUp}
                transition={{ delay: 0.2 }}
                className="md:col-span-4 rounded-[3rem] border border-slate-200 bg-slate-50 p-12 group hover:border-blue-600/20 transition-all"
              >
                <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-8">
                    <Wallet size={24} />
                </div>
                <h3 className="text-2xl font-black mb-4">Cuentas Corrientes</h3>
                <p className="text-slate-500 font-medium">
                  Gestioná saldos y deudas sin errores. Recordatorios de pago automáticos.
                </p>
              </motion.div>

              {/* Feature 4: Large Bento */}
              <motion.div 
                {...fadeInUp}
                transition={{ delay: 0.3 }}
                className="md:col-span-8 rounded-[3rem] bg-white border border-slate-200 p-12 relative overflow-hidden flex flex-col justify-between"
              >
                <div className="grid md:grid-cols-2 gap-8 items-center h-full">
                  <div>
                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-8">
                        <MessageSquare size={24} />
                    </div>
                    <h3 className="text-2xl font-black mb-4 tracking-tight">Comunicación Centralizada</h3>
                    <p className="text-slate-500 font-medium">
                      Olvidate del caos de WhatsApp. Tu equipo y clientes conectados en un solo lugar.
                    </p>
                  </div>
                  <div className="relative h-full flex items-center justify-center">
                     <div className="w-full h-40 bg-gradient-to-br from-indigo-100 to-blue-50 rounded-2xl border border-indigo-100 p-6 flex flex-col gap-4 shadow-inner">
                        <div className="h-3 w-[60%] bg-white rounded-full" />
                        <div className="h-3 w-[40%] bg-blue-200 rounded-full" />
                        <div className="h-3 w-[80%] bg-white rounded-full" />
                     </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* --- PROBLEM / SOLUTION SECTION (Deep Navy) --- */}
        <section className="py-40 bg-slate-950 text-white overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
             <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600 blur-[150px] rounded-full" />
             <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600 blur-[150px] rounded-full" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              <motion.div {...fadeInUp}>
                 <h2 className="text-xs font-black uppercase tracking-[0.4em] text-blue-400 mb-8">¿Por qué ZOMA?</h2>
                 <h3 className="text-4xl md:text-6xl font-black tracking-tight mb-10 leading-tight">
                   Dejá atrás el caos <br/> administrativo.
                 </h3>
                 
                 <div className="space-y-10">
                    <ProblemItem 
                      icon={Clock} 
                      title="No pierdas más tiempo" 
                      text="Automatizamos tareas repetitivas para que te enfoques en lo que importa: vender." 
                    />
                    <ProblemItem 
                      icon={TrendingUp} 
                      title="Visibilidad total" 
                      text="Tableros de control en tiempo real para tomar decisiones basadas en datos, no en corazonadas." 
                    />
                    <ProblemItem 
                      icon={Cpu} 
                      title="Tecnología que fluye" 
                      text="Sin errores de sincronización. Tu negocio online, rápido y siempre disponible." 
                    />
                 </div>
              </motion.div>

              <motion.div 
                {...fadeInUp}
                transition={{ delay: 0.2 }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-blue-600/20 to-indigo-900/40 rounded-[3.5rem] border border-white/10 p-12 md:p-20 backdrop-blur-sm">
                   <div className="flex flex-col gap-8">
                      <div className="flex items-center gap-6">
                        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                           <CheckCircle2 size={32} />
                        </div>
                        <p className="text-2xl font-black">Implementación en 24h</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="h-14 w-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                           <ShieldCheck size={32} />
                        </div>
                        <p className="text-2xl font-black">Seguridad Nivel Bancario</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="h-14 w-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                           <Zap size={32} />
                        </div>
                        <p className="text-2xl font-black">Escalabilidad Infinita</p>
                      </div>
                   </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* --- PRICING SECTION (Light Gray) --- */}
        <section id="pricing" className="py-40 bg-slate-50">
          <div className="container mx-auto px-6">
            <motion.div {...fadeInUp} className="text-center mb-24">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-blue-600 mb-6">Precios</h2>
              <p className="text-4xl md:text-5xl font-black tracking-tight text-slate-950">Inversión mínima, <br/> retorno máximo.</p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto">
              <PricingCard 
                title="Plan Base"
                price="70.000"
                description="Todo lo necesario para organizar tu pyme."
                features={[
                  "Presupuestos ilimitados",
                  "Cuentas corrientes",
                  "Integración MercadoPago",
                  "Soporte vía Ticket",
                  "1 Sucursal"
                ]}
              />
              <PricingCard 
                title="Plan PRO"
                price="140.000"
                popular
                description="La suite completa para dominar tu mercado."
                features={[
                  "Todo lo del Plan Base",
                  "Módulo de Stock & Recetas",
                  "Gestión de Vendedores",
                  "Comisiones Automáticas",
                  "Multi-Sucursal",
                  "Soporte Prioritario"
                ]}
              />
            </div>
          </div>
        </section>

        {/* --- FINAL CTA SECTION (Deep Blue) --- */}
        <section className="py-40 bg-white">
          <div className="container mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-blue-600 rounded-[4rem] p-12 md:p-32 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-600/30"
            >
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50" />
              
              <h2 className="text-5xl md:text-8xl font-black tracking-tighter mb-10 relative z-10">
                Tu empresa merece <br/> lo <span className="text-slate-900">mejor.</span>
              </h2>
              <p className="text-xl md:text-2xl text-blue-100 font-medium mb-16 max-w-2xl mx-auto relative z-10">
                Unite a las cientos de empresas que ya transformaron su gestión con ZOMA.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10">
                <Link 
                  href="/auth/register" 
                  className="w-full sm:w-auto rounded-3xl bg-white px-14 py-6 text-xl font-black text-blue-700 hover:scale-105 transition-all shadow-2xl"
                >
                  Empezar ahora gratis
                </Link>
                <p className="text-sm font-black uppercase tracking-widest text-blue-200">
                  Sin compromiso · 14 días de prueba
                </p>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* --- FOOTER (Minimal & Clean) --- */}
      <footer className="bg-white border-t border-slate-100 py-20">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-16 mb-20">
             <div className="max-w-xs">
                <Link href="/" className="flex items-center gap-2.5 mb-8">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <Sparkles size={16} />
                  </div>
                  <span className="text-lg font-black tracking-tight">ZOMA</span>
                </Link>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Transformando la gestión comercial de Argentina con tecnología de vanguardia.
                </p>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-3 gap-20">
                <div>
                   <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Producto</h4>
                   <ul className="space-y-4 text-sm font-black text-slate-600">
                      <li><Link href="#" className="hover:text-blue-600 transition">Funciones</Link></li>
                      <li><Link href="#" className="hover:text-blue-600 transition">Precios</Link></li>
                      <li><Link href="#" className="hover:text-blue-600 transition">Portal</Link></li>
                   </ul>
                </div>
                <div>
                   <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8">Compañía</h4>
                   <ul className="space-y-4 text-sm font-black text-slate-600">
                      <li><Link href="#" className="hover:text-blue-600 transition">Sobre nosotros</Link></li>
                      <li><Link href="#" className="hover:text-blue-600 transition">Contacto</Link></li>
                      <li><Link href="#" className="hover:text-blue-600 transition">Términos</Link></li>
                   </ul>
                </div>
             </div>
          </div>
          
          <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
             <p>© 2026 ZOMA Hub. Todos los derechos reservados.</p>
             <p>Hecho con ❤️ por Nailen</p>
          </div>
        </div>
      </footer>

    </div>
  )
}

function StatBlock({ label, value }: { label: string, value: string }) {
  return (
    <motion.div {...fadeInUp}>
      <p className="text-4xl font-black text-slate-950 mb-2">{value}</p>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
    </motion.div>
  )
}

function ProblemItem({ icon: Icon, title, text }: any) {
  return (
    <div className="flex gap-6">
       <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-blue-400">
          <Icon size={20} />
       </div>
       <div>
          <h4 className="text-xl font-black mb-2 tracking-tight">{title}</h4>
          <p className="text-slate-400 font-medium leading-relaxed">{text}</p>
       </div>
    </div>
  )
}

function PricingCard({ title, price, description, features, popular }: any) {
  return (
    <motion.div 
      {...fadeInUp}
      className={`p-12 rounded-[3.5rem] border ${
        popular 
          ? 'border-blue-600 bg-white shadow-[0_40px_80px_-20px_rgba(37,99,235,0.15)] ring-1 ring-blue-600/10' 
          : 'border-slate-200 bg-white'
      } relative overflow-hidden transition-all duration-500 hover:scale-[1.02]`}
    >
      {popular && (
        <div className="absolute top-0 right-12 -translate-y-1/2 rounded-full bg-blue-600 px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white">
          Más Elegido
        </div>
      )}
      
      <h3 className="text-2xl font-black mb-2 text-slate-950">{title}</h3>
      <p className="text-sm font-medium text-slate-400 mb-10">{description}</p>
      
      <div className="flex items-baseline gap-1 mb-12">
        <span className="text-sm font-black text-slate-400">$</span>
        <span className="text-6xl font-black text-slate-950 tracking-tighter">{price}</span>
        <span className="text-sm font-bold text-slate-400">/mes</span>
      </div>
      
      <div className="space-y-6 mb-14">
        {features.map((f: string) => (
          <div key={f} className="flex items-center gap-4 text-sm font-bold text-slate-700">
            <CheckCircle2 size={18} className="text-blue-600" />
            <span>{f}</span>
          </div>
        ))}
      </div>

      <Link 
        href="/auth/register" 
        className={`block w-full rounded-2xl py-5 text-center text-sm font-black uppercase tracking-widest transition-all ${
          popular 
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-600/20' 
            : 'bg-slate-900 text-white hover:bg-slate-800'
        }`}
      >
        Empezar Prueba Gratis
      </Link>
    </motion.div>
  )
}
