import Link from 'next/link'
import Image from 'next/image'
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
  Wallet
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc]">
      {/* Header / Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-600/20">
              <Sparkles size={20} />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              ZOMA<span className="text-blue-600">.</span>
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <Link href="#features" className="hover:text-blue-600 transition">Funcionalidades</Link>
            <Link href="#pricing" className="hover:text-blue-600 transition">Precios</Link>
            <Link href="/auth/login" className="hover:text-blue-600 transition">Ingresar</Link>
          </nav>

          <Link 
            href="/auth/register" 
            className="rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-slate-800 transition shadow-xl shadow-slate-950/10"
          >
            Comenzar Gratis
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-32 lg:pt-32 lg:pb-48">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-500/10 blur-[120px] rounded-full" />
          </div>
          
          <div className="container mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-blue-600 border border-blue-100 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Zap size={14} />
              El ERP diseñado para crecer
            </div>
            
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-950 mb-8 max-w-4xl mx-auto leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
              Gestiona tu empresa con la <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">inteligencia</span> que merece.
            </h1>
            
            <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              Presupuestos, ventas, stock y finanzas en una sola plataforma ultra rápida. Diseñada para equipos modernos que no tienen tiempo que perder.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              <Link 
                href="/auth/register" 
                className="w-full sm:w-auto rounded-2xl bg-blue-600 px-8 py-4 text-base font-black text-white hover:bg-blue-500 transition shadow-2xl shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                Empezar ahora <ArrowRight size={18} />
              </Link>
              <Link 
                href="#features" 
                className="w-full sm:w-auto rounded-2xl bg-white border border-slate-200 px-8 py-4 text-base font-black text-slate-700 hover:bg-slate-50 transition shadow-sm"
              >
                Ver funcionalidades
              </Link>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-24 container mx-auto px-6 animate-in fade-in zoom-in-95 duration-1000 delay-500">
            <div className="relative rounded-[2.5rem] border border-white/40 bg-white/20 p-2 backdrop-blur-sm shadow-2xl overflow-hidden">
               <div className="rounded-[2rem] overflow-hidden border border-slate-200 shadow-inner">
                  <Image 
                    src="/dashboard-mockup.png" 
                    alt="Zoma Dashboard Preview" 
                    width={1400} 
                    height={800} 
                    className="w-full h-auto object-cover"
                    priority
                  />
               </div>
               <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent pointer-events-none" />
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="bg-slate-950 py-20 text-white">
          <div className="container mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-center">
            <div>
              <p className="text-4xl font-black mb-2">99.9%</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Disponibilidad</p>
            </div>
            <div>
              <p className="text-4xl font-black mb-2">+150k</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Presupuestos</p>
            </div>
            <div>
              <p className="text-4xl font-black mb-2">2x</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ventas más rápidas</p>
            </div>
            <div>
              <p className="text-4xl font-black mb-2">24/7</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Soporte PRO</p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-blue-600 mb-4">Todo lo que necesitas</h2>
              <p className="text-4xl font-black text-slate-950 tracking-tight">Potencia cada área de tu negocio</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={BarChart3}
                title="Presupuestos Inteligentes"
                description="Crea propuestas premium en segundos y trackea cuándo tus clientes las abren en tiempo real."
              />
              <FeatureCard 
                icon={Wallet}
                title="Cuentas Corrientes"
                description="Control total de la deuda de tus clientes, pagos parciales y balances automáticos."
              />
              <FeatureCard 
                icon={Package}
                title="Stock & Recetas"
                description="Gestiona insumos y productos finales. Descuento automático de stock al vender."
              />
              <FeatureCard 
                icon={MessageSquare}
                title="Chat Interno"
                description="Comunicación fluida entre vendedores y administración sin salir de la plataforma."
              />
              <FeatureCard 
                icon={ShieldCheck}
                title="Seguridad Total"
                description="Tus datos están encriptados y protegidos con los más altos estándares de seguridad."
              />
              <FeatureCard 
                icon={Users}
                title="Portal de Clientes"
                description="Tus clientes pueden ver su saldo, descargar facturas y aprobar presupuestos online."
              />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-32 bg-slate-50 border-y border-slate-200/60">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
               <h2 className="text-xs font-black uppercase tracking-[0.3em] text-blue-600 mb-4">Planes para todos</h2>
               <p className="text-4xl font-black text-slate-950 tracking-tight">Precios transparentes, sin sorpresas</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <PricingCard 
                title="Plan Base"
                price="70.000"
                description="Ideal para comercios y profesionales independientes."
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
                description="Para empresas que necesitan control total de procesos."
                popular
                features={[
                  "Todo lo del Plan Base",
                  "Gestión de Stock e Insumos",
                  "Vendedores ilimitados",
                  "Comisiones automáticas",
                  "Tracking de visualizaciones",
                  "Soporte prioritario 24/7"
                ]}
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32">
          <div className="container mx-auto px-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[3rem] p-12 md:p-20 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-600/20">
              <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/10 blur-[80px] -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-blue-400/20 blur-[80px] translate-y-1/2 -translate-x-1/2" />
              
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-8 relative z-10">
                ¿Listo para transformar tu empresa?
              </h2>
              <p className="text-lg text-blue-100 mb-12 max-w-xl mx-auto font-medium relative z-10">
                Únete a las empresas que ya están vendiendo más y mejor con ZOMA.
              </p>
              
              <Link 
                href="/auth/register" 
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-10 py-5 text-lg font-black text-blue-700 hover:bg-blue-50 transition shadow-xl relative z-10"
              >
                Comenzar Prueba Gratis <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Sparkles size={16} />
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900">
              ZOMA<span className="text-blue-600">.</span>
            </span>
          </div>
          
          <p className="text-sm font-bold text-slate-400">
            © 2026 ZOMA Hub. Todos los derechos reservados.
          </p>

          <div className="flex items-center gap-6 text-sm font-bold text-slate-500">
            <Link href="#" className="hover:text-blue-600 transition">Términos</Link>
            <Link href="#" className="hover:text-blue-600 transition">Privacidad</Link>
            <Link href="#" className="hover:text-blue-600 transition">Contacto</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description }: any) {
  return (
    <div className="p-8 rounded-[2rem] border border-slate-200 bg-white hover:border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/5 transition duration-300">
      <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6">
        <Icon size={24} />
      </div>
      <h3 className="text-xl font-black text-slate-950 mb-3">{title}</h3>
      <p className="text-slate-500 font-medium leading-relaxed text-sm">{description}</p>
    </div>
  )
}

function PricingCard({ title, price, description, features, popular }: any) {
  return (
    <div className={`p-10 rounded-[2.5rem] border ${popular ? 'border-blue-600 bg-white shadow-2xl shadow-blue-600/10' : 'border-slate-200 bg-white'} relative`}>
      {popular && (
        <div className="absolute top-0 right-10 -translate-y-1/2 rounded-full bg-blue-600 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
          Más Popular
        </div>
      )}
      <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
      <p className="text-sm font-medium text-slate-500 mb-8">{description}</p>
      <div className="flex items-baseline gap-1 mb-8">
        <span className="text-sm font-black text-slate-400">$</span>
        <span className="text-5xl font-black text-slate-900">{price}</span>
        <span className="text-sm font-bold text-slate-400">/mes</span>
      </div>
      
      <div className="space-y-4 mb-10">
        {features.map((f: string) => (
          <div key={f} className="flex items-center gap-3 text-sm font-bold text-slate-600">
            <CheckCircle2 size={18} className="text-blue-600 shrink-0" />
            {f}
          </div>
        ))}
      </div>

      <Link 
        href="/auth/register" 
        className={`block w-full rounded-2xl py-4 text-center text-sm font-black transition ${
          popular 
            ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-600/20' 
            : 'bg-slate-950 text-white hover:bg-slate-800 shadow-xl shadow-slate-950/10'
        }`}
      >
        Seleccionar Plan
      </Link>
    </div>
  )
}
