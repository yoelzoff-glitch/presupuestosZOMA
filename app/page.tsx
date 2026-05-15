'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  Users, 
  BarChart3, 
  MessageSquare,
  Package,
  Wallet,
  Globe,
  Rocket
} from 'lucide-react'

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" }
} as const

const stagger = {
  initial: {},
  whileInView: {
    transition: {
      staggerChildren: 0.1
    }
  },
  viewport: { once: true }
}

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] overflow-x-hidden">
      {/* Dynamic Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[20%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[100px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] bg-cyan-400/5 blur-[80px] rounded-full animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/20 bg-white/60 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform duration-300">
              <Sparkles size={20} />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              ZOMA<span className="text-blue-600">.</span>
            </span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <Link href="#features" className="hover:text-blue-600 transition relative group">
              Funcionalidades
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full" />
            </Link>
            <Link href="#pricing" className="hover:text-blue-600 transition relative group">
              Precios
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full" />
            </Link>
            <Link href="/auth/login" className="hover:text-blue-600 transition relative group">
              Ingresar
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all group-hover:w-full" />
            </Link>
          </nav>

          <Link 
            href="/auth/register" 
            className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-blue-700 transition-all duration-300 shadow-xl shadow-slate-950/10 hover:shadow-blue-600/20"
          >
            Comenzar Gratis
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 lg:pt-32 lg:pb-48">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="text-left"
              >
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-600 border border-blue-600/20 mb-8">
                  <Rocket size={14} className="animate-bounce" />
                  El Futuro de la Gestión Comercial
                </div>
                
                <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-950 mb-8 leading-[1.1]">
                  Tu empresa, <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600">sin límites.</span>
                </h1>
                
                <p className="text-lg md:text-xl text-slate-600 font-medium max-w-xl mb-12 leading-relaxed">
                  ZOMA es la plataforma todo-en-uno que automatiza tus presupuestos, ventas y stock. Diseñada para ser ultra rápida y absurdamente bella.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Link 
                    href="/auth/register" 
                    className="w-full sm:w-auto rounded-2xl bg-blue-600 px-10 py-5 text-lg font-black text-white hover:bg-blue-500 transition-all duration-300 shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-2 group"
                  >
                    Empezar ahora <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link 
                    href="#features" 
                    className="w-full sm:w-auto rounded-2xl bg-white border border-slate-200 px-10 py-5 text-lg font-black text-slate-700 hover:bg-slate-50 transition shadow-sm"
                  >
                    Ver demo
                  </Link>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative hidden lg:block"
              >
                <div className="relative z-10 animate-float">
                  <Image 
                    src="/hero-3d.png" 
                    alt="Zoma Abstract 3D" 
                    width={800} 
                    height={800} 
                    className="w-full h-auto drop-shadow-[0_35px_35px_rgba(37,99,235,0.2)]"
                  />
                </div>
                {/* Floating Badges */}
                <motion.div 
                  animate={{ y: [0, -20, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-4 -right-4 z-20 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Zap size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Velocidad</p>
                    <p className="text-sm font-black text-slate-900">100% Optimizada</p>
                  </div>
                </motion.div>
                
                <motion.div 
                  animate={{ y: [0, 20, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute bottom-10 -left-10 z-20 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <BarChart3 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Crecimiento</p>
                    <p className="text-sm font-black text-slate-900">+45% Eficiencia</p>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Dashboard Showcase Section */}
        <section className="py-24 bg-gradient-to-b from-slate-50 to-white overflow-hidden">
          <div className="container mx-auto px-6">
            <motion.div 
              {...fadeInUp}
              className="text-center mb-16"
            >
              <motion.h2 
                className="text-4xl md:text-5xl font-black text-slate-950 tracking-tight mb-6"
              >
                Tu centro de mando, <span className="text-blue-600">reimaginado.</span>
              </motion.h2>
              <motion.p 
                className="text-lg text-slate-500 font-medium max-w-2xl mx-auto"
              >
                No es solo un sistema, es la ventaja competitiva que tu equipo necesita para dominar el mercado.
              </motion.p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="relative rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-[0_40px_100px_-20px_rgba(15,23,42,0.15)]"
            >
              <div className="rounded-[2rem] overflow-hidden border border-slate-100">
                <Image 
                  src="/dashboard-mockup.png" 
                  alt="Zoma Dashboard" 
                  width={1400} 
                  height={800} 
                  className="w-full h-auto"
                />
              </div>
              {/* Glass Accents */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/10 blur-3xl rounded-full" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-600/10 blur-3xl rounded-full" />
            </motion.div>
          </div>
        </section>

        {/* Features Grid with more life */}
        <section id="features" className="py-32 relative">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
              <motion.div {...fadeInUp} className="max-w-xl text-left">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-blue-600 mb-4">Potencia Total</h2>
                <p className="text-4xl md:text-5xl font-black text-slate-950 tracking-tight">Diseñado para cada etapa de tu negocio</p>
              </motion.div>
              <motion.div {...fadeInUp} transition={{ delay: 0.2 }}>
                 <Link href="/auth/register" className="group flex items-center gap-2 text-blue-600 font-black text-sm uppercase tracking-wider">
                   Ver todas las funciones <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                 </Link>
              </motion.div>
            </div>

            <motion.div 
              variants={stagger}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-8"
            >
              <FeatureCard 
                icon={BarChart3}
                color="blue"
                title="Presupuestos Pro"
                description="Envía propuestas interactivas que se ven perfectas en cualquier dispositivo."
              />
              <FeatureCard 
                icon={Wallet}
                color="indigo"
                title="Cuentas al Día"
                description="Controla saldos y deudas sin esfuerzo. Notificaciones automáticas de cobro."
              />
              <FeatureCard 
                icon={Package}
                color="cyan"
                title="Stock Inteligente"
                description="Sincronización total de insumos y productos. Nunca más te quedes sin stock."
              />
              <FeatureCard 
                icon={MessageSquare}
                color="violet"
                title="Chat Corporativo"
                description="Toda tu comunicación interna centralizada. Deja de usar WhatsApp para el trabajo."
              />
              <FeatureCard 
                icon={ShieldCheck}
                color="emerald"
                title="Blindado"
                description="Seguridad de grado bancario para tus datos y los de tus clientes."
              />
              <FeatureCard 
                icon={Globe}
                color="orange"
                title="Portal Cloud"
                description="Accede desde cualquier lugar del mundo. Tu negocio siempre contigo."
              />
            </motion.div>
          </div>
        </section>

        {/* Pricing with more vibrancy */}
        <section id="pricing" className="py-32 bg-slate-950 text-white relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute top-0 left-0 w-full h-full opacity-30">
            <div className="absolute top-[10%] right-[10%] w-[30%] h-[30%] bg-blue-600 blur-[120px] rounded-full" />
            <div className="absolute bottom-[10%] left-[10%] w-[30%] h-[30%] bg-indigo-600 blur-[120px] rounded-full" />
          </div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-20">
               <motion.h2 {...fadeInUp} className="text-xs font-black uppercase tracking-[0.3em] text-blue-400 mb-4">Precios</motion.h2>
               <motion.p {...fadeInUp} transition={{ delay: 0.1 }} className="text-4xl md:text-5xl font-black tracking-tight">Elige tu velocidad de crecimiento</motion.p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <PricingCard 
                title="Plan Base"
                price="70.000"
                description="Perfecto para empezar a profesionalizar tu marca."
                features={[
                  "Presupuestos ilimitados",
                  "Cuentas corrientes",
                  "Integración MercadoPago",
                  "Portal de clientes",
                  "Soporte vía Email"
                ]}
              />
              <PricingCard 
                title="Plan PRO"
                price="140.000"
                description="El set completo de herramientas para escalar sin límites."
                popular
                features={[
                  "Todo lo del Plan Base",
                  "Módulo de Stock & Recetas",
                  "Gestión de Vendedores",
                  "Comisiones Automáticas",
                  "Tracking de visualizaciones",
                  "Soporte prioritario 24/7"
                ]}
              />
            </div>
          </div>
        </section>

        {/* Big CTA Section */}
        <section className="py-32 bg-white">
          <div className="container mx-auto px-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 rounded-[4rem] p-12 md:p-24 text-center text-white relative overflow-hidden shadow-[0_50px_100px_-20px_rgba(37,99,235,0.3)]"
            >
              <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-white/10 blur-[100px] -translate-y-1/2 translate-x-1/2" />
              
              <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-8 relative z-10">
                Deja de administrar, <br/> empezá a <span className="text-cyan-300">crecer.</span>
              </h2>
              <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto font-medium relative z-10">
                Sumate a las empresas que ya ahorran más de 20 horas semanales en tareas administrativas con ZOMA.
              </p>
              
              <Link 
                href="/auth/register" 
                className="inline-flex items-center gap-3 rounded-2xl bg-white px-12 py-6 text-xl font-black text-blue-700 hover:scale-105 transition-all duration-300 shadow-2xl relative z-10 group"
              >
                Comenzar ahora gratis <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <p className="mt-8 text-sm font-bold text-blue-200/60 relative z-10 uppercase tracking-widest">
                Sin tarjeta de crédito · Prueba de 14 días
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Modern Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 pt-20 pb-10">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-20">
            <div className="col-span-1 md:col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg">
                  <Sparkles size={20} />
                </div>
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  ZOMA<span className="text-blue-600">.</span>
                </span>
              </Link>
              <p className="text-slate-500 font-medium max-w-sm leading-relaxed mb-8">
                Transformamos la forma en que las empresas gestionan sus ventas y operaciones. Tecnología de punta para el mundo real.
              </p>
              <div className="flex gap-4">
                {/* Social icons could go here */}
                <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 transition cursor-pointer">
                   <Globe size={18} />
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-6">Producto</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-500">
                <li><Link href="#features" className="hover:text-blue-600 transition">Funciones</Link></li>
                <li><Link href="#pricing" className="hover:text-blue-600 transition">Precios</Link></li>
                <li><Link href="#" className="hover:text-blue-600 transition">API</Link></li>
                <li><Link href="#" className="hover:text-blue-600 transition">Integraciones</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black text-slate-900 uppercase tracking-widest text-xs mb-6">Compañía</h4>
              <ul className="space-y-4 text-sm font-bold text-slate-500">
                <li><Link href="#" className="hover:text-blue-600 transition">Sobre nosotros</Link></li>
                <li><Link href="#" className="hover:text-blue-600 transition">Blog</Link></li>
                <li><Link href="#" className="hover:text-blue-600 transition">Contacto</Link></li>
                <li><Link href="#" className="hover:text-blue-600 transition">Privacidad</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-10 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm font-bold text-slate-400">
              © 2026 ZOMA Hub. Made with ❤️ in Argentina.
            </p>
            <div className="flex gap-8 text-xs font-black text-slate-400 uppercase tracking-widest">
               <span>Hecho por Nailen</span>
            </div>
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-easeInOut infinite;
        }
      `}</style>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description, color }: any) {
  const colorMap: any = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600'
  }

  return (
    <motion.div 
      variants={fadeInUp}
      className="p-10 rounded-[3rem] border border-slate-200 bg-white hover:border-blue-500/30 hover:shadow-[0_30px_60px_-15px_rgba(37,99,235,0.1)] transition-all duration-500 group"
    >
      <div className={`h-14 w-14 rounded-2xl ${colorMap[color]} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={28} />
      </div>
      <h3 className="text-2xl font-black text-slate-950 mb-4 tracking-tight">{title}</h3>
      <p className="text-slate-500 font-medium leading-relaxed">{description}</p>
    </motion.div>
  )
}

function PricingCard({ title, price, description, features, popular }: any) {
  return (
    <motion.div 
      variants={fadeInUp}
      className={`p-10 md:p-14 rounded-[3.5rem] border ${
        popular 
          ? 'border-blue-600 bg-white text-slate-950 shadow-[0_40px_80px_-20px_rgba(37,99,235,0.25)]' 
          : 'border-white/10 bg-white/5 text-white backdrop-blur-sm'
      } relative overflow-hidden group transition-all duration-500`}
    >
      {popular && (
        <div className="absolute top-0 right-14 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-xl">
          Súper Recomendado
        </div>
      )}
      
      <h3 className={`text-2xl font-black mb-2 ${popular ? 'text-slate-950' : 'text-white'}`}>{title}</h3>
      <p className={`text-sm font-medium mb-10 ${popular ? 'text-slate-500' : 'text-slate-400'}`}>{description}</p>
      
      <div className="flex items-baseline gap-1 mb-12">
        <span className="text-sm font-black opacity-40">$</span>
        <span className={`text-6xl font-black ${popular ? 'text-slate-950' : 'text-white'}`}>{price}</span>
        <span className="text-sm font-bold opacity-40">/mes</span>
      </div>
      
      <div className="space-y-6 mb-12">
        {features.map((f: string) => (
          <div key={f} className="flex items-center gap-4 text-sm font-bold">
            <CheckCircle2 size={20} className={popular ? 'text-blue-600' : 'text-blue-400'} />
            <span className={popular ? 'text-slate-700' : 'text-slate-300'}>{f}</span>
          </div>
        ))}
      </div>

      <Link 
        href="/auth/register" 
        className={`block w-full rounded-2xl py-5 text-center text-base font-black transition-all duration-300 ${
          popular 
            ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-600/20' 
            : 'bg-white text-slate-950 hover:bg-slate-200 shadow-xl shadow-white/10'
        }`}
      >
        Empezar Ahora
      </Link>
    </motion.div>
  )
}
