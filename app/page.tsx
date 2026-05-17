'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  BarChart3, 
  Package,
  Wallet,
  Clock,
  TrendingUp,
  Cpu,
  ChevronRight,
  Calculator,
  Check,
  ChevronDown,
  Printer,
  Layers,
  Users,
  Eye,
  X,
  Play
} from 'lucide-react'

export default function LandingPage() {
  // Modal state for Interactive System Tour
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)

  // Interactive Features Tab state
  const [activeTab, setActiveTab] = useState<'tracking' | 'afip' | 'remitos' | 'vendedores'>('tracking')

  // FAQ state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  // ROI Calculator states
  const [monthlyBudgets, setMonthlyBudgets] = useState(60)
  const [manualTime, setManualTime] = useState(25) // minutes per budget

  // AFIP Feature Simulator states
  const [issuerType, setIssuerType] = useState<'monotributo' | 'responsable_inscripto'>('responsable_inscripto')
  const [clientType, setClientType] = useState<'final' | 'ri_cuit'>('ri_cuit')
  const [invoiceAmount, setInvoiceAmount] = useState(210000)

  // Remito Millimeter Simulator states
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)

  // Vendedor Commission Simulator states
  const [commissionRate, setCommissionRate] = useState(5) // %

  // Simulated live metrics ticker
  const [budgetsCreated, setBudgetsCreated] = useState(482140)
  useEffect(() => {
    const interval = setInterval(() => {
      setBudgetsCreated(prev => prev + Math.floor(Math.random() * 2) + 1)
    }, 4500)
    return () => clearInterval(interval)
  }, [])

  // ROI Calculations
  const hoursSaved = Math.round((monthlyBudgets * manualTime) / 60)
  const moneySaved = Math.round((monthlyBudgets * manualTime * 8500) / 60) // $8.500 ARS/hour manual cost
  const conversionIncrease = Math.round(monthlyBudgets * 0.16) // ~16% increase in closures due to timely tracking

  // Interactive Tour Slides
  const tourSlides = [
    {
      title: "1. Generación Veloz",
      description: "Cargá el cliente, seleccioná los productos o materias primas y armá un presupuesto impecable en menos de 10 segundos. Sin planillas lentas ni errores de tipeo.",
      badge: "Cero Esfuerzo",
      icon: Layers,
      color: "from-blue-600 to-indigo-600",
      element: (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left font-sans text-xs text-slate-300 shadow-2xl relative overflow-hidden">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
            <span className="font-bold text-white flex items-center gap-1.5"><Sparkles size={13} className="text-blue-400" /> Nuevo Presupuesto</span>
            <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase">Borrador</span>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Cliente</label>
                <div className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-medium">Distribuidora Norte</div>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-1">Condición Comercial</label>
                <div className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-medium">Cuenta Corriente</div>
              </div>
            </div>
            <div className="border border-slate-850 rounded overflow-hidden">
              <div className="bg-slate-950 px-3 py-1.5 font-bold text-[10px] text-slate-400 grid grid-cols-12 border-b border-slate-850">
                <span className="col-span-8">Ítems</span>
                <span className="col-span-2 text-right">Cant.</span>
                <span className="col-span-2 text-right">Total</span>
              </div>
              <div className="p-3 space-y-2 bg-slate-900/60">
                <div className="grid grid-cols-12 text-slate-200">
                  <span className="col-span-8 font-medium">Materia Prima Premium A5</span>
                  <span className="col-span-2 text-right text-slate-400 font-mono">10</span>
                  <span className="col-span-2 text-right font-mono font-bold">$120.000</span>
                </div>
                <div className="grid grid-cols-12 text-slate-200">
                  <span className="col-span-8 font-medium">Servicio Calibración Técnica</span>
                  <span className="col-span-2 text-right text-slate-400 font-mono">1</span>
                  <span className="col-span-2 text-right font-mono font-bold">$90.000</span>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] text-slate-500">Impuestos incl.</span>
              <span className="text-sm font-black text-emerald-400 font-mono">$210.000 ARS</span>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
        </div>
      )
    },
    {
      title: "2. Envío con Trazabilidad",
      description: "Generá un enlace público profesional para tu cliente. Compartilo instantáneamente por WhatsApp o mail directamente desde Zoma.",
      badge: "WhatsApp Ready",
      icon: Eye,
      color: "from-emerald-600 to-teal-600",
      element: (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-left font-sans text-xs text-slate-300 shadow-2xl relative">
          <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-900/30 rounded-xl p-3 mb-4">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Eye size={16} />
            </div>
            <div>
              <p className="font-bold text-white text-[11px]">Enlace Único Activado</p>
              <p className="text-[10px] text-slate-400 font-mono">zoma.app/p/presu-981</p>
            </div>
          </div>
          <div className="bg-slate-950 rounded-xl p-3 border border-slate-850 font-mono text-[10px] text-slate-400 space-y-2">
            <div className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              [HISTORIAL DE RASTREO]
            </div>
            <p className="text-slate-200">12:38 - El cliente abrió el enlace público (Dispositivo Móvil, CABA)</p>
            <p className="text-slate-500">12:35 - Presupuesto compartido por WhatsApp</p>
            <p className="text-slate-500">12:34 - Presupuesto creado por vendedor Martin</p>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-4 italic">Sabé el segundo exacto en que tu cliente está leyendo tu oferta.</p>
        </div>
      )
    },
    {
      title: "3. Factura Electrónica AFIP",
      description: "Con el Plan Ultra, no cargues dos veces la información. Presioná un botón y Zoma se conecta de forma segura con ARCA/AFIP para generar el CAE y facturar al instante.",
      badge: "100% Homologado",
      icon: ShieldCheck,
      color: "from-violet-600 to-purple-600",
      element: (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-left text-slate-800 shadow-2xl relative font-sans text-xs">
          <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
            <div>
              <h4 className="font-black text-slate-950 text-sm tracking-tight">FACTURA A</h4>
              <p className="text-[9px] text-slate-400 font-mono">N° 0002-00003418</p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded uppercase">AFIP Aprobada</span>
          </div>
          <div className="space-y-2 font-mono text-[9px] text-slate-600">
            <div className="flex justify-between"><span className="font-bold text-slate-800">Emisor CUIT:</span> <span>30-71458921-9</span></div>
            <div className="flex justify-between"><span className="font-bold text-slate-800">Receptor CUIT:</span> <span>30-50239481-2</span></div>
            <div className="flex justify-between"><span className="font-bold text-slate-800">CAE Autorizado:</span> <span className="font-bold text-slate-900">74219503859203</span></div>
            <div className="flex justify-between"><span className="font-bold text-slate-800">Vence CAE:</span> <span>2026-05-27</span></div>
            <div className="border-t border-dashed border-slate-200 my-2 pt-2 flex justify-between text-[11px] text-slate-950 font-bold">
              <span>Total Facturado:</span>
              <span className="text-indigo-600">$210.000,00</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-1.5 bg-indigo-50 text-indigo-700 font-bold p-2 rounded-xl text-[10px]">
            <CheckCircle2 size={13} /> Sincronizado automáticamente
          </div>
        </div>
      )
    },
    {
      title: "4. Calibración y Remito Físico",
      description: "Imprimí sobre tus propios talonarios preimpresos sin perder papel. Calibrá los campos al milímetro con compensación X/Y para una precisión absoluta.",
      badge: "Precisión Milimétrica",
      icon: Printer,
      color: "from-amber-600 to-orange-600",
      element: (
        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 text-left font-sans text-xs text-slate-400 shadow-2xl relative">
          <div className="mb-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Calibrador Activo</p>
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono text-[10px]">
              <span className="text-amber-500">Offset X:</span> <span className="bg-slate-950 px-1.5 py-0.5 rounded font-bold">+1.2 mm</span>
              <span className="text-amber-500 ml-2">Offset Y:</span> <span className="bg-slate-950 px-1.5 py-0.5 rounded font-bold">-0.8 mm</span>
            </div>
          </div>
          <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3 text-[10px] text-amber-200/90 leading-relaxed font-mono">
            <span className="font-bold text-amber-400 block mb-1">🛡️ Control de C.A.I. Validado</span>
            El remito se genera con posicionamiento en base a coordenadas absolutas (2.83465 pt/mm) asegurando que calce justo en las celdas físicas de tu talonario.
          </div>
          <p className="text-[9px] text-slate-500 mt-4 text-center italic">Adaptado a impresoras de matriz de puntos y láser.</p>
        </div>
      )
    }
  ]

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 overflow-x-hidden text-slate-200 selection:bg-indigo-600 selection:text-white font-sans antialiased">
      
      {/* GLOWING TECH GRADIENTS BACKGROUND */}
      <div className="absolute top-0 left-0 w-full h-[1200px] opacity-[0.35] pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[700px] bg-gradient-to-br from-indigo-700/60 to-violet-800/10 blur-[130px] rounded-full" />
        <div className="absolute top-[10%] right-[-10%] w-[60%] h-[600px] bg-gradient-to-bl from-blue-700/50 to-indigo-900/15 blur-[120px] rounded-full" />
        <div className="absolute top-[40%] left-[20%] w-[70%] h-[800px] bg-gradient-to-tr from-purple-800/30 to-slate-950 blur-[140px] rounded-full" />
      </div>

      {/* --- NAVIGATION --- */}
      <nav className="fixed top-0 z-[100] w-full bg-slate-950/75 backdrop-blur-2xl border-b border-slate-900 transition-all duration-300">
        <div className="container mx-auto flex h-22 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-300">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-white leading-none">ZOMA</span>
              <span className="text-[9px] font-black tracking-widest text-indigo-400 uppercase">Hub Comercial</span>
            </div>
          </Link>
          
          <div className="hidden md:flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
            <Link href="#features" className="hover:text-white hover:scale-102 transition duration-200">Funciones</Link>
            <Link href="#interactive" className="hover:text-white hover:scale-102 transition duration-200">Simuladores</Link>
            <Link href="#pricing" className="hover:text-white hover:scale-102 transition duration-200">Precios</Link>
            <Link href="#faq" className="hover:text-white hover:scale-102 transition duration-200">Preguntas</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/auth/login" 
              className="hidden sm:inline-block text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 hover:text-white transition duration-200"
            >
              Ingresar
            </Link>
            <Link 
              href="/auth/register" 
              className="rounded-xl bg-indigo-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-indigo-500 hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-all duration-300"
            >
              Probar Gratis
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        
        {/* --- HERO SECTION --- */}
        <section className="relative pt-36 pb-24 lg:pt-48 lg:pb-36 overflow-hidden">
          
          {/* Tech Grid Background Backdrop */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35" />

          <div className="container mx-auto px-6 relative">
            
            <div className="max-w-5xl mx-auto text-center mb-16">
              
              {/* Dynamic Live Ticker Badge */}
              <div 
                className="inline-flex items-center gap-2.5 rounded-full bg-slate-900/90 border border-slate-800 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-8 shadow-inner shadow-indigo-950/20"
              >
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>{budgetsCreated.toLocaleString('es-AR')} Presupuestos Gestionados</span>
              </div>
              
              {/* Mega Title */}
              <h1 
                className="text-5xl md:text-8xl font-black tracking-tight text-white mb-8 leading-[0.98]"
              >
                El ERP comercial de <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-500">
                  alto rendimiento
                </span> <br/>
                para tu Pyme.
              </h1>
              
              {/* Copy Persuasivo */}
              <p 
                className="text-lg md:text-xl text-slate-400 font-medium max-w-3xl mx-auto mb-12 leading-relaxed"
              >
                ZOMA unifica presupuestos con rastreo de vistas, facturación directa AFIP, calibración milimétrica de remitos físicos y gestión de vendedores en una plataforma hiper-veloz.
              </p>

              {/* Call to Actions */}
              <div 
                className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-16"
              >
                <Link 
                  href="/auth/register" 
                  className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-10 py-5 text-base font-black text-white hover:from-indigo-500 hover:to-blue-500 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 shadow-[0_0_35px_rgba(99,102,241,0.25)] flex items-center justify-center gap-2 group"
                >
                  Probar 14 días gratis
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <button 
                  onClick={() => {
                    setTourStep(0);
                    setIsTourOpen(true);
                  }}
                  className="w-full sm:w-auto rounded-xl bg-slate-900 border border-slate-800 px-10 py-5 text-base font-black text-white hover:bg-slate-850 hover:border-slate-700 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play size={16} className="text-indigo-400 fill-indigo-400" />
                  Ver Demo Interactiva
                </button>
              </div>

              {/* Floating Badges */}
              <div 
                className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-400"
              >
                <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-850 px-4 py-2 rounded-full">
                  <ShieldCheck size={16} className="text-emerald-400" />
                  <span>Factura AFIP Directa</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-850 px-4 py-2 rounded-full">
                  <Eye size={16} className="text-indigo-400" />
                  <span>Rastreo "Doble Check"</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-850 px-4 py-2 rounded-full">
                  <Printer size={16} className="text-amber-400" />
                  <span>Remitos Calibrados</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-850 px-4 py-2 rounded-full">
                  <Users size={16} className="text-blue-400" />
                  <span>Comisiones de Venta</span>
                </div>
              </div>

            </div>

            {/* Premium Mockup Showcase */}
            <div 
              className="relative max-w-6xl mx-auto transition-all duration-700 ease-out"
            >
              {/* Decorative side lights */}
              <div className="absolute top-[-10%] left-[-5%] w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full" />
              <div className="absolute bottom-[20%] right-[-5%] w-48 h-48 bg-blue-500/10 blur-3xl rounded-full" />

              <div className="relative rounded-3xl border border-slate-800 bg-slate-950/80 p-3 shadow-[0_50px_100px_-25px_rgba(0,0,0,0.8)] backdrop-blur-md overflow-hidden">
                <div className="rounded-2xl overflow-hidden border border-slate-900 relative aspect-[16/9] w-full">
                  <Image 
                    src="/dashboard-mockup.png" 
                    alt="Zoma Dashboard" 
                    fill
                    className="object-cover"
                    priority
                  />
                  
                  {/* Subtle dark-to-transparent overlay on mockup */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- TRUST STATS BANNER --- */}
        <section className="py-16 bg-slate-950/70 border-y border-slate-900 relative">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 items-center text-center">
              <StatBlock label="Emitidos sin Errores" value="+450.000" />
              <StatBlock label="Empresas Registradas" value="+1.200" />
              <StatBlock label="Uptime Garantizado" value="99.9%" />
              <StatBlock label="Ahorro en Procesos" value="14h/semana" />
            </div>
          </div>
        </section>

        {/* --- BENTO FEATURES --- */}
        <section id="features" className="py-36 bg-slate-950 relative">
          <div className="container mx-auto px-6">
            
            <div className="text-center mb-24">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-5">Eficiencia Absoluta</h2>
              <p className="text-4xl md:text-6xl font-black tracking-tight text-white animate-fadeIn">
                Todo lo que necesitás <br/>
                para tu flujo de ventas.
              </p>
            </div>

            <div className="grid md:grid-cols-12 gap-8 auto-rows-[360px]">
              
              {/* Feature 1: Large Bento (Presupuestos de Conversión) */}
              <div 
                className="md:col-span-8 rounded-3xl border border-slate-850 bg-gradient-to-br from-slate-900 to-slate-950 p-10 md:p-12 text-white relative overflow-hidden group hover:border-slate-800 transition-all duration-300"
              >
                <div className="relative z-10 max-w-lg flex flex-col h-full justify-between">
                  <div>
                    <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-8 shadow-inner shadow-indigo-500/10">
                      <BarChart3 size={22} />
                    </div>
                    <h3 className="text-3xl font-black mb-4 tracking-tight">Presupuestos que Venden</h3>
                    <p className="text-slate-400 font-medium text-base leading-relaxed">
                      Armá presupuestos con recetas de stock complejas. Tus clientes los leen en un portal dinámico público adaptado para móviles, con doble check en tiempo real.
                    </p>
                  </div>
                  <div className="mt-8">
                    <span className="inline-flex items-center gap-2 text-indigo-400 font-black text-xs uppercase tracking-widest group-hover:text-indigo-300 transition-colors">
                      Trazabilidad Total <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
                
                {/* Decorative growth graphic inside card */}
                <div className="absolute right-[-5%] bottom-[-5%] w-[45%] h-[80%] opacity-40 group-hover:scale-105 transition-transform duration-700 pointer-events-none">
                  <Image 
                    src="/growth-icon-dark.png" 
                    alt="Growth" 
                    fill 
                    className="object-contain object-right-bottom mix-blend-lighten"
                  />
                </div>
              </div>

              {/* Feature 2: Small Bento (Facturación AFIP) */}
              <div 
                className="md:col-span-4 rounded-3xl border border-indigo-900/30 bg-gradient-to-br from-indigo-900/20 via-slate-900 to-slate-950 p-10 md:p-12 text-white relative overflow-hidden group hover:border-indigo-800/30 transition-all duration-300"
              >
                <div className="flex flex-col h-full justify-between relative z-10">
                  <div>
                    <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center mb-8">
                      <ShieldCheck size={22} />
                    </div>
                    <h3 className="text-2xl font-black mb-4 tracking-tight">Facturación AFIP</h3>
                    <p className="text-slate-400 font-medium text-sm leading-relaxed">
                      Olvidate de duplicar datos en la web de AFIP. Generá facturas A, B y C firmadas directamente por ARCA en un click.
                    </p>
                  </div>
                  <div className="bg-indigo-500/10 text-indigo-300 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-indigo-500/20 w-fit">
                    Plan ULTRA
                  </div>
                </div>
                {/* Visual grid blur effect */}
                <div className="absolute bottom-[-15%] right-[-15%] w-36 h-36 bg-indigo-500/10 blur-3xl rounded-full" />
              </div>

              {/* Feature 3: Small Bento (Remitos en Talonarios) */}
              <div 
                className="md:col-span-4 rounded-3xl border border-slate-850 bg-slate-900/60 p-10 md:p-12 text-white relative overflow-hidden group hover:border-slate-800 transition-all duration-300"
              >
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-8">
                      <Printer size={22} />
                    </div>
                    <h3 className="text-2xl font-black mb-4 tracking-tight">Remito Milimétrico</h3>
                    <p className="text-slate-400 font-medium text-sm leading-relaxed">
                      Imprimí directo sobre tus remitos preimpresos físicos. Calibrá los offsets exactos en milímetros para alineación perfecta y evitá desperdicios.
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    Posicionamiento absoluto PDF-Lib
                  </div>
                </div>
              </div>

              {/* Feature 4: Large Bento (Vendedores y Comisiones) */}
              <div 
                className="md:col-span-8 rounded-3xl border border-slate-850 bg-gradient-to-br from-slate-950 to-slate-900 p-10 md:p-12 relative overflow-hidden flex flex-col justify-between group hover:border-slate-800 transition-all duration-300"
              >
                <div className="grid md:grid-cols-2 gap-8 items-center h-full">
                  <div className="flex flex-col justify-between h-full">
                    <div>
                      <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-8">
                        <Users size={22} />
                      </div>
                      <h3 className="text-3xl font-black mb-4 tracking-tight">Fuerza de Ventas</h3>
                      <p className="text-slate-400 font-medium text-base leading-relaxed">
                        Asigná presupuestos a vendedores específicos. Zoma calcula de forma automática sus comisiones de venta en base a las reglas configuradas.
                      </p>
                    </div>
                    <div className="mt-8 text-slate-400 text-xs font-bold flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" /> Panel exclusivo para vendedores (/vendedor)
                    </div>
                  </div>
                  
                  {/* Interactive-looking graphic inside large bento */}
                  <div className="relative h-full flex items-center justify-center">
                    <div className="w-full bg-slate-950 border border-slate-850 rounded-2xl p-5 shadow-2xl space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-850 pb-2">
                        <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Comisiones Generales</span>
                        <span className="bg-blue-500/10 text-blue-400 text-[9px] font-black px-2 py-0.5 rounded">Liquidando</span>
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-white">Martin Rivas (5% com.)</span>
                          <span className="font-mono text-emerald-400 font-bold">$125.000,00</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full w-[70%]" />
                        </div>
                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="font-bold text-white">Sofia Lopez (8% com.)</span>
                          <span className="font-mono text-emerald-400 font-bold">$144.000,00</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full w-[55%]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* --- INTERACTIVE SHOWCASE SECTION --- */}
        <section id="interactive" className="py-36 bg-slate-900/40 border-y border-slate-900 relative">
          <div className="container mx-auto px-6">
            
            <div className="text-center mb-16">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-5">Demostrador en Vivo</h2>
              <p className="text-4xl md:text-5xl font-black tracking-tight text-white animate-fadeIn">
                Probá las funciones de Zoma.
              </p>
              <p className="text-slate-400 max-w-xl mx-auto mt-4 font-medium">
                Interactuá con los simuladores interactivos basados en el motor de nuestro software.
              </p>
            </div>

            {/* Dynamic Tabs Selector */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-12 max-w-3xl mx-auto bg-slate-950/60 p-2 rounded-2xl border border-slate-850">
              <TabButton 
                active={activeTab === 'tracking'} 
                onClick={() => setActiveTab('tracking')}
                icon={Eye} 
                label="Trazabilidad" 
              />
              <TabButton 
                active={activeTab === 'afip'} 
                onClick={() => setActiveTab('afip')}
                icon={ShieldCheck} 
                label="Facturador AFIP" 
              />
              <TabButton 
                active={activeTab === 'remitos'} 
                onClick={() => setActiveTab('remitos')}
                icon={Printer} 
                label="Calibración Remito" 
              />
              <TabButton 
                active={activeTab === 'vendedores'} 
                onClick={() => setActiveTab('vendedores')}
                icon={Users} 
                label="Vendedores" 
              />
            </div>

            {/* Tabs Dynamic Content Panel */}
            <div className="max-w-5xl mx-auto bg-slate-950 border border-slate-850 rounded-[2.5rem] p-8 md:p-12 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-300">
              
              {/* TAB 1: TRAZABILIDAD (DOBLE CHECK) */}
              {activeTab === 'tracking' && (
                <div
                  className="grid md:grid-cols-2 gap-10 items-center transition-opacity duration-300 ease-in-out"
                >
                  <div>
                    <span className="bg-indigo-500/10 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-500/20 mb-4 inline-block">
                      El "Doble Check" Administrativo
                    </span>
                    <h3 className="text-3xl font-black text-white mb-5 leading-tight">
                      Se acabó el "¿Le llegó el correo?"
                    </h3>
                    <p className="text-slate-400 font-medium leading-relaxed mb-6">
                      Cuando creás un presupuesto, Zoma genera una URL segura única. En el momento en que tu cliente la abre, el backend actualiza de inmediato el registro <code className="text-indigo-400 font-mono">viewed_at</code> sin requerir inicios de sesión.
                    </p>
                    <ul className="space-y-3.5 text-sm font-bold text-slate-300">
                      <li className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-indigo-400 shrink-0" />
                        <span>Notificación instantánea silenciosa</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-indigo-400 shrink-0" />
                        <span>Identificación de dispositivo e IP del receptor</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-indigo-400 shrink-0" />
                        <span>Optimización del momento ideal de cierre</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-black text-slate-500 uppercase block">Presupuesto Público</span>
                        <span className="text-white font-mono font-bold">#PZ-2026-981</span>
                      </div>
                      <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-black px-2 py-0.5 rounded">Enviado</span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-medium">Cliente:</span>
                        <span className="text-white font-bold">Aberturas Castelli</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400 font-medium">Importe:</span>
                        <span className="text-emerald-400 font-mono font-bold">$384.500 ARS</span>
                      </div>
                      
                      <div className="border border-slate-800 bg-slate-950 p-4 rounded-xl space-y-2 mt-2">
                        <div className="text-indigo-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <span className="h-2 w-2 bg-indigo-500 rounded-full animate-ping shrink-0" />
                          Registro de Visitas Activo
                        </div>
                        
                        <div className="text-[11px] space-y-2 text-slate-300 font-mono leading-relaxed pt-1.5">
                          <div className="flex gap-2">
                            <span className="text-indigo-400">👁️</span>
                            <p><span className="text-white font-bold">Visto hace 1 minuto</span> desde CABA, Chrome Mobile (Red Claro)</p>
                          </div>
                          <div className="flex gap-2 text-slate-500">
                            <span className="text-slate-600">✓</span>
                            <p>Enviado por WhatsApp - 12:30</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FACTURADOR AFIP */}
              {activeTab === 'afip' && (
                <div
                  className="grid md:grid-cols-2 gap-10 items-center transition-opacity duration-300 ease-in-out"
                >
                  <div>
                    <span className="bg-indigo-500/10 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-500/20 mb-4 inline-block">
                      Emisión Automática e Inteligente
                    </span>
                    <h3 className="text-3xl font-black text-white mb-5 leading-tight">
                      Integración Segura con AFIP/ARCA
                    </h3>
                    <p className="text-slate-400 font-medium leading-relaxed mb-6">
                      Zoma analiza automáticamente el tipo de IVA del emisor y del cliente receptor para definir el comprobante adecuado. Además, controla los límites de identificación fiscal vigentes sin que tengas que estudiar normativas.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monto del Presupuesto</label>
                        <input 
                          type="range" 
                          min="50000" 
                          max="300000" 
                          step="10000"
                          value={invoiceAmount} 
                          onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                          className="accent-indigo-500 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer h-2"
                        />
                        <span className="font-mono text-sm font-black text-white">$ {invoiceAmount.toLocaleString('es-AR')} ARS</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Tu Régimen</label>
                          <select 
                            value={issuerType} 
                            onChange={(e: any) => setIssuerType(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl p-2.5 outline-none font-bold cursor-pointer"
                          >
                            <option value="responsable_inscripto">Resp. Inscripto</option>
                            <option value="monotributo">Monotributista</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-2">Tipo de Cliente</label>
                          <select 
                            value={clientType} 
                            onChange={(e: any) => setClientType(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-xl p-2.5 outline-none font-bold cursor-pointer"
                          >
                            <option value="ri_cuit">Empresa (CUIT)</option>
                            <option value="final">Consumidor Final (S/I)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-3xl p-6 text-slate-800 font-sans text-xs space-y-4 shadow-2xl">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-black text-slate-950 text-sm tracking-tight uppercase">
                          {issuerType === 'monotributo' ? 'Factura C' : (clientType === 'ri_cuit' ? 'Factura A' : 'Factura B')}
                        </h4>
                        <span className="text-[9px] text-slate-400 font-mono">Punto de Venta 0002 · CUIT Emisor</span>
                      </div>
                      <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded uppercase">Previsualización</span>
                    </div>

                    <div className="space-y-2 text-[10px] text-slate-600 font-mono">
                      <div className="flex justify-between"><span>Condición Iva Emisor:</span> <span className="font-bold text-slate-900">{issuerType === 'monotributo' ? 'Monotributo' : 'Responsable Inscripto'}</span></div>
                      <div className="flex justify-between"><span>Condición Iva Cliente:</span> <span className="font-bold text-slate-900">{clientType === 'ri_cuit' ? 'Responsable Inscripto' : 'Consumidor Final'}</span></div>
                      
                      <div className="border-t border-slate-150 my-2 pt-2 space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                          <span>Subtotal Neto:</span> 
                          <span className="font-bold text-slate-900">
                            $ {issuerType === 'monotributo' || clientType === 'final' ? invoiceAmount.toLocaleString('es-AR') : Math.round(invoiceAmount / 1.21).toLocaleString('es-AR')}
                          </span>
                        </div>
                        {issuerType === 'responsable_inscripto' && clientType === 'ri_cuit' && (
                          <div className="flex justify-between text-indigo-600">
                            <span>IVA discriminado (21%):</span> 
                            <span className="font-bold">$ {Math.round(invoiceAmount - (invoiceAmount / 1.21)).toLocaleString('es-AR')}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm text-slate-950 font-black pt-1 border-t border-slate-100">
                          <span>Total Facturado:</span> 
                          <span>$ {invoiceAmount.toLocaleString('es-AR')} ARS</span>
                        </div>
                      </div>
                    </div>

                    {/* AFIP Rule Validation Alert */}
                    {invoiceAmount > 191624 && clientType === 'final' ? (
                      <div className="bg-rose-50 border border-rose-200 text-rose-800 font-bold p-3 rounded-2xl text-[10px] leading-relaxed">
                        ⚠️ **Regla AFIP Activa:** El monto supera los **$191.624**. Por normativa legal, es obligatorio identificar al cliente con DNI o CUIT.
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold p-3 rounded-2xl text-[10px]">
                        ✓ El presupuesto cumple con las normativas vigentes de AFIP/ARCA.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CALIBRACION REMITO */}
              {activeTab === 'remitos' && (
                <div
                  className="grid md:grid-cols-2 gap-10 items-center transition-opacity duration-300 ease-in-out"
                >
                  <div>
                    <span className="bg-indigo-500/10 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-500/20 mb-4 inline-block">
                      Cero desperdicio de talonarios
                    </span>
                    <h3 className="text-3xl font-black text-white mb-5 leading-tight">
                      Calibrador Milimétrico en Ejes X e Y
                    </h3>
                    <p className="text-slate-400 font-medium leading-relaxed mb-6">
                      No pierdas más remitos preimpresos por culpa de la desalineación de tu impresora. Zoma convierte cada milímetro en coordenadas absolutas de PDF. Podés corregir cualquier desvío de alimentación de papel deslizando los controles.
                    </p>
                    
                    <div className="space-y-6">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <span>Desplazamiento Horizontal (Eje X)</span>
                          <span className="font-mono text-amber-400">{offsetX > 0 ? `+${offsetX}` : offsetX} mm</span>
                        </div>
                        <input 
                          type="range" 
                          min="-12" 
                          max="12" 
                          value={offsetX} 
                          onChange={(e) => setOffsetX(Number(e.target.value))}
                          className="accent-amber-500 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer h-2"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <span>Desplazamiento Vertical (Eje Y)</span>
                          <span className="font-mono text-amber-400">{offsetY > 0 ? `+${offsetY}` : offsetY} mm</span>
                        </div>
                        <input 
                          type="range" 
                          min="-12" 
                          max="12" 
                          value={offsetY} 
                          onChange={(e) => setOffsetY(Number(e.target.value))}
                          className="accent-amber-500 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer h-2"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    {/* Interactive Visual Paper Mockup */}
                    <div className="w-full max-w-[280px] aspect-[1/1.4] bg-white border-2 border-dashed border-amber-500/40 p-4 shadow-2xl rounded-xl relative overflow-hidden text-[9px] text-slate-800 font-mono">
                      {/* Simulation Guide Grid */}
                      <div className="absolute inset-0 bg-[radial-gradient(#f1f5f9_1px,transparent_1.5px)] bg-[size:10px_10px] opacity-70" />
                      
                      <div className="absolute inset-x-0 top-0 bg-amber-500/10 border-b border-amber-500/20 py-1 text-center text-[7px] font-bold text-amber-800 tracking-wider uppercase z-20">
                        Área del Talonario Físico
                      </div>

                      {/* Animated offset wrapper */}
                      <div 
                        style={{ 
                          transform: `translate(${offsetX * 1.5}px, ${offsetY * 1.5}px)`,
                          transition: 'transform 0.15s ease-out'
                        }}
                        className="space-y-4 pt-6 relative z-10"
                      >
                        <div className="flex justify-between items-start border-b border-slate-200 pb-1.5">
                          <span className="font-bold text-slate-950 text-[10px]">REMITO R</span>
                          <span className="text-rose-600 font-bold">N° 0001-00004812</span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="bg-slate-100 p-1 rounded"><span className="text-slate-400">Cliente:</span> Aberturas Castelli</div>
                          <div className="bg-slate-100 p-1 rounded"><span className="text-slate-400">Domicilio:</span> Av. Rivadavia 4810</div>
                        </div>

                        <div className="border border-slate-200 rounded overflow-hidden">
                          <div className="bg-slate-50 p-1 font-bold border-b border-slate-200 grid grid-cols-6 text-[7px]">
                            <span className="col-span-4">Detalle</span>
                            <span className="col-span-2 text-right">Cant.</span>
                          </div>
                          <div className="p-1 space-y-1 text-[7px]">
                            <div className="grid grid-cols-6">
                              <span className="col-span-4">Perfiles Aluminio</span>
                              <span className="col-span-2 text-right">40</span>
                            </div>
                            <div className="grid grid-cols-6">
                              <span className="col-span-4">Accesorios Cierre</span>
                              <span className="col-span-2 text-right">2</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-[8px] pt-1">
                          <span className="text-slate-400">CAI N°: 4892019485</span>
                          <span className="text-slate-950 font-bold">Fecha: 17/05/2026</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: FUERZA DE VENTAS Y COMISIONES */}
              {activeTab === 'vendedores' && (
                <div
                  className="grid md:grid-cols-2 gap-10 items-center transition-opacity duration-300 ease-in-out"
                >
                  <div>
                    <span className="bg-indigo-500/10 text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-500/20 mb-4 inline-block">
                      Incentivo y Control
                    </span>
                    <h3 className="text-3xl font-black text-white mb-5 leading-tight">
                      Cálculo de Comisiones en Tiempo Real
                    </h3>
                    <p className="text-slate-400 font-medium leading-relaxed mb-6">
                      Estimulá a tu equipo de ventas brindándoles un portal dedicado donde pueden armar presupuestos. Zoma calcula la comisión automáticamente al concretarse la venta.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Porcentaje de Comisión</label>
                        <input 
                          type="range" 
                          min="2" 
                          max="12" 
                          step="0.5"
                          value={commissionRate} 
                          onChange={(e) => setCommissionRate(Number(e.target.value))}
                          className="accent-indigo-500 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer h-2"
                        />
                        <span className="font-mono text-sm font-black text-white">{commissionRate} %</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Fuerza de Ventas</span>
                      <span className="text-emerald-400 text-[10px] font-bold">Comisión Activa: {commissionRate}%</span>
                    </div>

                    <div className="space-y-4">
                      
                      {/* Seller 1 */}
                      <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white text-xs">Vendedor: Martin Rivas</span>
                          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">6 Ventas</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-500">Total Facturado:</span>
                          <span className="text-slate-300 font-bold">$ 2.200.000,00</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono pt-1.5 border-t border-slate-900 text-emerald-400 font-bold">
                          <span>Comisión ganada:</span>
                          <span>$ {Math.round(2200000 * (commissionRate / 100)).toLocaleString('es-AR')},00</span>
                        </div>
                      </div>

                      {/* Seller 2 */}
                      <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white text-xs">Vendedor: Sofia Lopez</span>
                          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">4 Ventas</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-500">Total Facturado:</span>
                          <span className="text-slate-300 font-bold">$ 1.500.000,00</span>
                        </div>
                        <div className="flex justify-between text-xs font-mono pt-1.5 border-t border-slate-900 text-emerald-400 font-bold">
                          <span>Comisión ganada:</span>
                          <span>$ {Math.round(1500000 * (commissionRate / 100)).toLocaleString('es-AR')},00</span>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        </section>

        {/* --- DYNAMIC ROI CALCULATOR --- */}
        <section className="py-36 bg-slate-950 relative">
          
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#4f46e50f_0%,transparent_60%)] pointer-events-none" />

          <div className="container mx-auto px-6 relative">
            
            <div className="max-w-5xl mx-auto rounded-[3.5rem] border border-slate-850 bg-gradient-to-br from-slate-900 to-slate-950 p-8 md:p-16 shadow-3xl">
              
              <div className="grid lg:grid-cols-12 gap-12 items-center">
                
                <div className="lg:col-span-7 space-y-8">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-4.5 py-1.5 text-[10px] font-black uppercase tracking-widest mb-6">
                      <Calculator size={13} />
                      Calculadora de Retorno (ROI)
                    </span>
                    <h3 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                      Mirá cuánto tiempo <br/> y costos podés recuperar.
                    </h3>
                  </div>

                  <p className="text-slate-400 font-medium">
                    La automatización de procesos no solo reduce errores de IVA o logística, sino que te libera valiosas horas mensuales para enfocarte puramente en vender.
                  </p>

                  <div className="space-y-6">
                    {/* Budget slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-400">Presupuestos enviados al mes:</span>
                        <span className="text-white font-mono font-black">{monthlyBudgets}</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="400" 
                        value={monthlyBudgets} 
                        onChange={(e) => setMonthlyBudgets(Number(e.target.value))}
                        className="w-full accent-indigo-500 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer h-2"
                      />
                    </div>

                    {/* Time slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-400">Minutos manuales por presupuesto (Armar, enviar, AFIP, remito):</span>
                        <span className="text-white font-mono font-black">{manualTime} min</span>
                      </div>
                      <input 
                        type="range" 
                        min="5" 
                        max="60" 
                        value={manualTime} 
                        onChange={(e) => setManualTime(Number(e.target.value))}
                        className="w-full accent-indigo-500 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer h-2"
                      />
                    </div>
                  </div>
                </div>

                {/* Calculations output box */}
                <div className="lg:col-span-5 bg-indigo-600 rounded-[2.5rem] p-8 md:p-10 text-white relative overflow-hidden shadow-2xl">
                  {/* Decorative mesh */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50 pointer-events-none" />

                  <div className="relative z-10 space-y-8">
                    
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Horas Recuperadas</p>
                      <p className="text-5xl font-black tracking-tight font-mono">{hoursSaved} hs <span className="text-sm text-indigo-200">/mes</span></p>
                      <p className="text-[10px] text-indigo-100/80 mt-1 font-medium">Equivalente a más de {Math.round(hoursSaved / 8)} jornadas laborales liberadas.</p>
                    </div>

                    <div className="border-t border-white/10 pt-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Ahorro Estimado en Costos</p>
                      <p className="text-4xl font-black tracking-tight font-mono">$ {moneySaved.toLocaleString('es-AR')}</p>
                      <p className="text-[10px] text-indigo-100/80 mt-1 font-medium">Basado en eficiencia de procesos administrativos.</p>
                    </div>

                    <div className="border-t border-white/10 pt-6">
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Incremento Estimado de Ventas</p>
                      <p className="text-2xl font-black tracking-tight font-mono">+{conversionIncrease} cierres <span className="text-xs text-indigo-200">/mes</span></p>
                      <p className="text-[10px] text-indigo-100/80 mt-1 font-medium">Por seguimiento ágil al recibir la alerta de vista.</p>
                    </div>

                  </div>
                </div>

              </div>

            </div>

          </div>
        </section>

        {/* --- DEEP DIVE TECHNICAL DETAILS --- */}
        <section className="py-36 bg-slate-950 text-white overflow-hidden relative border-t border-slate-900">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_#312e810a_0%,transparent_50%)] pointer-events-none" />

          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-24 items-center">
              
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-6">Robustez Corporativa</h2>
                <h3 className="text-4xl md:text-5xl font-black tracking-tight mb-8 leading-tight">
                  Diseñado para las exigencias comerciales de hoy.
                </h3>
                <p className="text-slate-400 font-medium text-base mb-10 leading-relaxed">
                  ZOMA no es solo una interfaz bonita; es un motor transaccional robusto desarrollado sobre estándares de seguridad bancaria, adaptándose sin fallas a las complejidades impositivas vigentes.
                </p>
                
                <div className="space-y-8">
                  <TechDetailRow 
                    icon={ShieldCheck} 
                    title="Certificados Fiscales en SandBox y Producción" 
                    text="Conectá tus archivos crt y key provistos por AFIP. Contamos con entorno Sandbox para pruebas seguras antes de dar de alta comprobantes reales." 
                  />
                  <TechDetailRow 
                    icon={Zap} 
                    title="Control de C.A.I. Activo" 
                    text="El software valida automáticamente la fecha límite de tus autorizaciones (ej. vencimiento 09/03/2027) lanzando alertas preventivas antes de imprimir remitos fuera de término." 
                  />
                  <TechDetailRow 
                    icon={Cpu} 
                    title="Límites Automatizados AFIP" 
                    text="Sincronización de reglas en tiempo real, bloqueando comprobantes a consumidor final sin identificar si superan los montos regulados." 
                  />
                </div>
              </div>

              <div 
                className="relative"
              >
                <div className="bg-gradient-to-br from-indigo-600/10 to-slate-900/40 rounded-[3rem] border border-slate-800 p-10 md:p-14 backdrop-blur-sm relative">
                  <div className="absolute top-0 right-0 transform translate-x-3 -translate-y-3 bg-indigo-500 text-slate-950 font-black uppercase text-[9px] tracking-widest px-3.5 py-1.5 rounded-xl">
                    Especificaciones
                  </div>
                  
                  <div className="space-y-8">
                    <div className="flex items-start gap-5">
                      <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                        <Check size={18} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-white">Infraestructura Supabase</p>
                        <p className="text-sm text-slate-400 mt-1 font-medium">Bases de datos relacionales PostgreSQL con políticas RLS (Row Level Security) activas para protección infranqueable.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-5">
                      <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                        <Check size={18} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-white">Precisión Decimal Financiera</p>
                        <p className="text-sm text-slate-400 mt-1 font-medium">Cálculos exactos en centavos para redondeo legal de IVA (21%) previniendo discrepancias con ARCA.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-5">
                      <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                        <Check size={18} />
                      </div>
                      <div>
                        <p className="text-lg font-black text-white">Uptime Nube del 99.9%</p>
                        <p className="text-sm text-slate-400 mt-1 font-medium">Respaldos redundantes en la nube para asegurar que tu sistema de ventas siga online, las 24 horas.</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>

        {/* --- PRICING SECTION --- */}
        <section id="pricing" className="py-36 bg-slate-900/30 relative border-t border-slate-900">
          <div className="container mx-auto px-6">
            
            <div className="text-center mb-24">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-5">Planes Comerciales</h2>
              <p className="text-4xl md:text-5xl font-black tracking-tight text-white">
                Inversión transparente para tu Pyme.
              </p>
              <p className="text-slate-400 mt-4 max-w-lg mx-auto font-medium">
                Sin cargos ocultos ni configuraciones sorpresa. Facturación 100% mensual según escala.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
              
              {/* PLAN BASE */}
              <PricingCard 
                title="Plan Base"
                price="100.000"
                description="Organiza tus presupuestos y cuentas corrientes sin demoras."
                features={[
                  "Presupuestos en formato PDF/Web",
                  "Módulo Cuentas Corrientes",
                  "Trazabilidad básica de vistas",
                  "Integración MercadoPago",
                  "1 Sucursal y 2 Vendedores",
                  "Soporte vía Tickets"
                ]}
              />

              {/* PLAN PRO */}
              <PricingCard 
                title="Plan PRO"
                price="140.000"
                description="La suite de control completa para pymes en crecimiento."
                features={[
                  "Todo lo del Plan Base",
                  "Control de Stock & Inventario",
                  "Fórmulas de Recetas complejas",
                  "Liquidación Vendedores (/vendedor)",
                  "Comisiones Automatizadas",
                  "Soporte Prioritario",
                  "3 Sucursales"
                ]}
                badge="Muy Elegido"
              />

              {/* PLAN ULTRA */}
              <PricingCard 
                title="Plan ULTRA"
                price="190.000"
                description="Automatización total con Facturación AFIP directa y homologada."
                features={[
                  "Todo lo del Plan PRO",
                  "Facturación AFIP directa (ARCA)",
                  "Emisión Facturas A, B y C",
                  "Sincronización Sandbox & Producción",
                  "Calibrador de Remito físico (Offset)",
                  "Validación CUIT en tiempo real",
                  "Soporte Telefónico Dedicado 24/7"
                ]}
                popular
                badge="Facturación Integrada"
              />

            </div>
          </div>
        </section>

        {/* --- FAQ SECTION --- */}
        <section id="faq" className="py-36 bg-slate-950 border-t border-slate-900">
          <div className="container mx-auto px-6">
            
            <div className="text-center mb-24">
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-5">Preguntas Frecuentes</h2>
              <p className="text-4xl md:text-5xl font-black tracking-tight text-white animate-fadeIn">
                Dudas técnicas y comerciales.
              </p>
            </div>

            <div className="max-w-4xl mx-auto space-y-4">
              <FaqItem 
                question="¿Cómo funciona la calibración milimétrica para remitos preimpresos?"
                answer="Cada talonario físico tiene celdas con coordenadas específicas. Zoma calcula la posición de dibujo de texto usando PDF-Lib con precisión matemática absoluta (2.83465 puntos tipográficos por milímetro). Los parámetros de Compensación (X/Y Offset) en el panel de configuración te permiten ajustar físicamente los textos milímetro a milímetro para compensar el desvío físico del alimentador de papel de tu impresora."
                isOpen={openFaqIndex === 0}
                toggle={() => setOpenFaqIndex(openFaqIndex === 0 ? null : 0)}
              />
              <FaqItem 
                question="¿La facturación directa de AFIP requiere que yo ponga mi certificado digital?"
                answer="Sí. Para emitir Facturas A, B o C legales en el Plan Ultra, debés subir tus archivos de credencial fiscal (.crt y .key) provistos por AFIP/ARCA a través de tu clave fiscal. Zoma los almacena de manera encriptada y realiza la autenticación segura para solicitar el CAE directamente al servidor de AFIP."
                isOpen={openFaqIndex === 1}
                toggle={() => setOpenFaqIndex(openFaqIndex === 1 ? null : 1)}
              />
              <FaqItem 
                question="¿Qué es la trazabilidad de vistas y cómo sé si el cliente abrió el presupuesto?"
                answer="Cuando envías un presupuesto, el sistema le genera un enlace único público. Cuando el cliente accede a ese enlace, se dispara silenciosamente una llamada segura a nuestra API. Esta función guarda la marca temporal (viewed_at), la dirección IP y el dispositivo del cliente. De esta forma, ves al instante en tu panel un indicador visual verde si tu presupuesto ya fue leído."
                isOpen={openFaqIndex === 2}
                toggle={() => setOpenFaqIndex(openFaqIndex === 2 ? null : 2)}
              />
              <FaqItem 
                question="¿Puedo probar el sistema de manera gratuita?"
                answer="Sí, absolutamente. Ofrecemos 14 días de prueba sin cargo y sin compromiso de permanencia en todos nuestros planes. Podés crear presupuestos, gestionar tu stock y probar el sistema libremente."
                isOpen={openFaqIndex === 3}
                toggle={() => setOpenFaqIndex(openFaqIndex === 3 ? null : 3)}
              />
              <FaqItem 
                question="¿Qué validez tiene el control de vencimiento del C.A.I. en los remitos?"
                answer="Por reglamentación legal, los talonarios preimpresos tienen una fecha límite de validez otorgada por AFIP (C.A.I.). El backend de Zoma valida automáticamente la fecha del remito contra la vigencia de tu C.A.I. y te muestra advertencias claras en pantalla para evitar que emitas comprobantes inválidos que puedan traerte sanciones administrativas."
                isOpen={openFaqIndex === 4}
                toggle={() => setOpenFaqIndex(openFaqIndex === 4 ? null : 4)}
              />
            </div>

          </div>
        </section>

        {/* --- FINAL CTA SECTION --- */}
        <section className="py-36 bg-slate-950 border-t border-slate-900 relative">
          <div className="container mx-auto px-6">
            
            <div 
              className="bg-indigo-600 rounded-[3rem] p-12 md:p-24 text-center text-white relative overflow-hidden shadow-2xl shadow-indigo-600/20"
            >
              {/* Decorative radial light */}
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.1)_0%,transparent_70%)] opacity-60 pointer-events-none" />
              
              <h2 className="text-4xl md:text-7xl font-black tracking-tight mb-8 relative z-10 leading-none">
                Tu Pyme merece <br/>
                el mejor sistema.
              </h2>
              <p className="text-lg md:text-xl text-indigo-100 font-medium mb-12 max-w-2xl mx-auto relative z-10">
                Unite hoy a las cientos de empresas que agilizaron su circuito administrativo con ZOMA.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5 relative z-10">
                <Link 
                  href="/auth/register" 
                  className="w-full sm:w-auto rounded-xl bg-white px-10 py-5 text-base font-black text-indigo-700 hover:scale-[1.04] transition-all shadow-xl flex items-center justify-center"
                >
                  Empezar ahora gratis
                </Link>
                <span className="text-xs font-black uppercase tracking-widest text-indigo-200">
                  Prueba de 14 días · Sin tarjetas
                </span>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* --- FOOTER --- */}
      <footer className="bg-slate-950 border-t border-slate-900 py-16 relative z-10">
        <div className="container mx-auto px-6">
          
          <div className="grid md:grid-cols-4 gap-12 items-start mb-16">
            
            <div className="space-y-6">
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
                  <Sparkles size={16} />
                </div>
                <span className="text-lg font-black tracking-tighter text-white">ZOMA</span>
              </Link>
              <p className="text-slate-500 font-medium text-xs leading-relaxed max-w-xs">
                La plataforma líder en presupuestos y gestión integral de ventas adaptada al comercio en Argentina.
              </p>
            </div>
            
            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-6">Módulos Core</h4>
              <ul className="space-y-3.5 text-xs font-bold text-slate-400">
                <li><Link href="#features" className="hover:text-indigo-400 transition">Presupuestos Trazables</Link></li>
                <li><Link href="#features" className="hover:text-indigo-400 transition">Facturación AFIP (ARCA)</Link></li>
                <li><Link href="#features" className="hover:text-indigo-400 transition">Calibrador de Remitos</Link></li>
                <li><Link href="#features" className="hover:text-indigo-400 transition">Gestión Vendedores</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-6">Compañía</h4>
              <ul className="space-y-3.5 text-xs font-bold text-slate-400">
                <li><Link href="#" className="hover:text-indigo-400 transition duration-200">Sobre Nosotros</Link></li>
                <li><Link href="#" className="hover:text-indigo-400 transition duration-200">Términos del Servicio</Link></li>
                <li><Link href="#" className="hover:text-indigo-400 transition duration-200">Políticas de Privacidad</Link></li>
                <li><Link href="#" className="hover:text-indigo-400 transition duration-200">Contacto Técnico</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-6">Regulación Argentina</h4>
              <ul className="space-y-3.5 text-xs font-bold text-slate-400">
                <li><span className="text-slate-500 font-medium block leading-relaxed">Conexión Homologada a servidores ARCA. Liquidación con estándares de normativa fiscal AFIP 2026.</span></li>
              </ul>
            </div>

          </div>

          <div className="pt-10 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <p>© {new Date().getFullYear()} ZOMA Hub. Todos los derechos reservados.</p>
            <p>Creado para impulsar el comercio argentino ❤️</p>
          </div>

        </div>
      </footer>

      {/* --- TOUR INTERACTIVE MODAL (SIMULATION DEMO) --- */}
      {isTourOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all duration-300"
        >
          <div 
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl p-6 md:p-10 shadow-2xl relative overflow-hidden"
          >
            
            {/* Close button */}
            <button 
              onClick={() => setIsTourOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-850 p-2 rounded-xl border border-slate-800 transition cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="grid md:grid-cols-12 gap-8 items-center pt-4">
              
              {/* Visual Simulation Display */}
              <div className="md:col-span-5 flex justify-center items-center">
                <div className="w-full max-w-xs relative aspect-square flex items-center justify-center bg-slate-950 border border-slate-850 p-6 rounded-2xl shadow-inner overflow-hidden">
                  <div className="w-full h-full flex items-center justify-center transition-all duration-300">
                    {tourSlides[tourStep].element}
                  </div>
                </div>
              </div>

              {/* Copy steps control */}
              <div className="md:col-span-7 space-y-6">
                <div>
                  <span className="bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em] px-3.5 py-1.5 rounded-full border border-indigo-500/20 mb-4 inline-block">
                    {tourSlides[tourStep].badge}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-black text-white leading-tight">
                    {tourSlides[tourStep].title}
                  </h3>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed font-medium">
                  {tourSlides[tourStep].description}
                </p>

                {/* Navigation Bullets */}
                <div className="flex gap-1.5 items-center">
                  {tourSlides.map((_, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setTourStep(idx)}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${tourStep === idx ? 'w-8 bg-indigo-500' : 'w-2 bg-slate-800'}`}
                    />
                  ))}
                </div>

                {/* Navigation controls */}
                <div className="flex gap-3 pt-4">
                  {tourStep > 0 && (
                    <button 
                      onClick={() => setTourStep(prev => prev - 1)}
                      className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-3.5 text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white transition cursor-pointer"
                    >
                      Anterior
                    </button>
                  )}
                  
                  {tourStep < tourSlides.length - 1 ? (
                    <button 
                      onClick={() => setTourStep(prev => prev + 1)}
                      className="rounded-xl bg-indigo-600 px-8 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:bg-indigo-500 transition shadow-[0_0_20px_rgba(99,102,241,0.2)] cursor-pointer"
                    >
                      Siguiente Paso
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsTourOpen(false)}
                      className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-3.5 text-xs font-black uppercase tracking-wider text-white hover:scale-103 transition shadow-[0_0_25px_rgba(99,102,241,0.25)] cursor-pointer"
                    >
                      ¡Comenzar ahora!
                    </button>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}

/* SUBCOMPONENT: Metric Counter Block */
function StatBlock({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-3xl md:text-5xl font-black text-white font-mono tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
        {value}
      </p>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
      </p>
    </div>
  )
}

/* SUBCOMPONENT: Tech Detail Paragraph Row */
function TechDetailRow({ icon: Icon, title, text }: any) {
  return (
    <div className="flex gap-5">
       <div className="h-10 w-10 rounded-xl bg-slate-900 border border-slate-850 flex items-center justify-center shrink-0 text-indigo-400 shadow-inner">
          <Icon size={18} />
       </div>
       <div>
          <h4 className="text-lg font-black mb-1.5 text-white tracking-tight leading-tight">{title}</h4>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">{text}</p>
       </div>
    </div>
  )
}

/* SUBCOMPONENT: Interactive Tab Switcher Button */
function TabButton({ active, icon: Icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
          : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
      }`}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  )
}

/* SUBCOMPONENT: FAQ Accordion Single Card */
function FaqItem({ question, answer, isOpen, toggle }: any) {
  return (
    <div className="border border-slate-900 bg-slate-950/60 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-800">
      <button 
        onClick={toggle}
        className="w-full flex items-center justify-between p-6 text-left outline-none cursor-pointer"
      >
        <span className="font-black text-white text-base md:text-lg tracking-tight pr-4">
          {question}
        </span>
        <ChevronDown 
          size={18} 
          className={`text-indigo-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-96 opacity-100 pb-6' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 text-slate-400 text-sm leading-relaxed font-medium">
          {answer}
        </div>
      </div>
    </div>
  )
}

/* SUBCOMPONENT: Pricing Plan Card */
function PricingCard({ title, price, description, features, popular, badge }: any) {
  return (
    <div 
      className={`p-10 md:p-12 rounded-[2.5rem] border ${
        popular 
          ? 'border-indigo-600 bg-slate-900 shadow-[0_30px_60px_-15px_rgba(99,102,241,0.15)] ring-1 ring-indigo-600/10' 
          : 'border-slate-900 bg-slate-950'
      } relative overflow-hidden transition-all duration-500 hover:scale-[1.02] flex flex-col justify-between`}
    >
      {badge && (
        <div className="absolute top-0 right-10 -translate-y-1/2 rounded-full bg-indigo-600 px-4 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-white">
          {badge}
        </div>
      )}
      
      <div>
        <h3 className="text-2xl font-black mb-1.5 text-white tracking-tight">{title}</h3>
        <p className="text-xs font-medium text-slate-500 mb-8">{description}</p>
        
        <div className="flex items-baseline gap-1 mb-8">
          <span className="text-sm font-black text-slate-500">$</span>
          <span className="text-5xl font-black text-white tracking-tighter font-mono">{price}</span>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">/ mes</span>
        </div>
        
        <div className="space-y-4 mb-10">
          {features.map((f: string) => (
            <div key={f} className="flex items-start gap-3.5 text-xs font-bold text-slate-300">
              <CheckCircle2 size={16} className="text-indigo-400 shrink-0 mt-0.5" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <Link 
        href="/auth/register" 
        className={`block w-full rounded-xl py-4.5 text-center text-xs font-black uppercase tracking-widest transition-all duration-300 ${
          popular 
            ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/15' 
            : 'bg-slate-900 text-white hover:bg-slate-850 hover:text-white border border-slate-800'
        }`}
      >
        Probar 14 días gratis
      </Link>
    </div>
  )
}
