'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Lock, Mail, Building2, ChevronRight, CheckCircle2, Sparkles, TrendingUp, Users, FileSpreadsheet, Download, Clock } from 'lucide-react'

export default function Register() {
  const router = useRouter()


  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<'base' | 'pro'>('pro')

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!companyName.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMsg('Completá todos los campos.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    const { data: signUpData, error: signUpError } =
      await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

    if (signUpError || !signUpData.user) {
      setLoading(false)
      setErrorMsg(signUpError?.message || 'No se pudo crear la cuenta.')
      return
    }

    const userId = signUpData.user.id

    const registerCompanyResponse = await fetch(
      '/api/register-company',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_name: companyName.trim(),
          email: email.trim(),
          user_id: userId,
          plan_type: selectedPlan,
        }),
      }
    )

    const registerCompanyData =
      await registerCompanyResponse.json()

    setLoading(false)

    if (!registerCompanyResponse.ok) {
      setErrorMsg(
        registerCompanyData?.detail ||
        registerCompanyData?.error ||
        'La cuenta se creó, pero no se pudo crear la empresa.'
      )
      return
    }

    setSuccessMsg('¡Cuenta creada! Redirigiendo...')

    setTimeout(() => {
      router.replace('/auth/login')
    }, 1500)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {/* Background Decorative Elements */}
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-600/20 blur-[120px]" />
      <div className="absolute -left-24 bottom-0 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[150px]" />

      <div className="relative flex min-h-screen">
        {/* Left Side: Login Form */}
        <section className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-top-8 duration-700">
            <div className="mb-10 text-center lg:text-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-400/20">
                Nuevo registro
              </div>
              <h2 className="text-4xl font-black tracking-tight text-white">
                Sumá tu empresa
              </h2>
              <p className="mt-3 font-medium text-slate-500">
                Comenzá a gestionar tus presupuestos hoy mismo.
              </p>
            </div>

            <form
              onSubmit={handleRegister}
              className="space-y-5 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl lg:p-10"
            >
              {errorMsg && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-400">
                  <CheckCircle2 size={18} />
                  {successMsg}
                </div>
              )}

              <div className="space-y-4">
                {/* Selector de Planes */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Seleccioná tu Plan
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Plan BASE */}
                    <button
                      type="button"
                      onClick={() => setSelectedPlan('base')}
                      className={`relative flex flex-col justify-between p-4.5 rounded-2xl border text-left transition-all duration-300 ${selectedPlan === 'base'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-black text-white">Plan BASE</span>
                          <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center ${selectedPlan === 'base'
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-slate-500'
                            }`}>
                            {selectedPlan === 'base' && (
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                          Factura ARCA, deudas y portal de contador
                        </p>
                      </div>
                      <div className="mt-4 flex items-baseline gap-0.5">
                        <span className="text-[10px] font-bold text-slate-500">$</span>
                        <span className="text-xl font-mono font-black text-white">80.000</span>
                        <span className="text-[8px] font-bold text-slate-500 ml-0.5">/mes</span>
                      </div>
                    </button>

                    {/* Plan PRO */}
                    <button
                      type="button"
                      onClick={() => setSelectedPlan('pro')}
                      className={`relative flex flex-col justify-between p-4.5 rounded-2xl border text-left transition-all duration-300 ${selectedPlan === 'pro'
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/20'
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                        }`}
                    >
                      {/* Popular / Recomendado Badge */}
                      <div className="absolute -top-2.5 right-4 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-[#020617]">
                        Recomendado
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-black text-white">Plan PRO</span>
                          <div className={`h-4.5 w-4.5 rounded-full border flex items-center justify-center ${selectedPlan === 'pro'
                            ? 'border-emerald-500 bg-emerald-500'
                            : 'border-slate-500'
                            }`}>
                            {selectedPlan === 'pro' && (
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                          Todo BASE, stock, 10 vendedores y chat
                        </p>
                      </div>
                      <div className="mt-4 flex items-baseline gap-0.5">
                        <span className="text-[10px] font-bold text-slate-500">$</span>
                        <span className="text-xl font-mono font-black text-white">110.000</span>
                        <span className="text-[8px] font-bold text-slate-500 ml-0.5">/mes</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Nombre de la Empresa
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Building2 size={20} />
                    </div>
                    <input
                      type="text"
                      value={companyName}
                      placeholder="ej: Zoma Tech"
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Email Administrativo
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Mail size={20} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      placeholder="admin@tuempresa.com"
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Contraseña
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Lock size={20} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="Mínimo 6 caracteres"
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-12 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Confirmar Contraseña
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Lock size={20} />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      placeholder="Repetir contraseña"
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-12 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Cartel de prueba de 7 días */}
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs font-bold text-emerald-400">
                <Sparkles className="shrink-0 text-emerald-400 mt-0.5 animate-pulse" size={18} />
                <div>
                  <p className="font-extrabold text-white">💥 ¡7 días de prueba gratis!</p>
                  <p className="mt-0.5 font-medium leading-relaxed text-slate-400">
                    Acceso completo e instantáneo al plan seleccionado sin tarjeta de crédito ni compromisos.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-xl shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Crear mi cuenta
                    <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="pt-4 text-center">
                <p className="text-sm font-bold text-slate-500">
                  ¿Ya tenés cuenta?{' '}
                  <Link
                    href="/auth/login"
                    className="text-emerald-400 transition-colors hover:text-emerald-300"
                  >
                    Iniciá sesión
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* Right Side: Visual/Branding */}
        <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
          {/* Vibrant Mesh Background */}
          <div className="absolute inset-0 z-0 opacity-60">
            <div
              className="h-full w-full"
              style={{
                background: 'radial-gradient(circle at 20% 30%, #064e3b 0%, transparent 50%), radial-gradient(circle at 80% 70%, #1e1b4b 0%, #0f172a 100%)',
              }}
            />
            {/* Grid Overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/50" />
          </div>

          {/* Top Logo */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/40 ring-1 ring-white/20">
                <CheckCircle2 className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">
                ZOMA <span className="text-emerald-500">ERP</span>
              </span>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-400 backdrop-blur">
              v2.4 Pro
            </div>
          </div>

          {/* Interactive Floating Dashboard Composition */}
          <div className="relative z-10 my-auto flex flex-col justify-center">
            <div className="mb-10 text-left">
              <h1 className="text-5xl font-black leading-[1.1] tracking-tight text-white lg:text-6xl animate-fadeIn">
                Escalá tu negocio <br />
                sin <span className="text-emerald-400 underline decoration-emerald-400/30 underline-offset-8">límites.</span>
              </h1>
              <p className="mt-6 max-w-md text-base font-medium leading-relaxed text-slate-400">
                Registrate en segundos y empezá a profesionalizar tu gestión comercial.
                Todo lo que necesitás en un solo lugar.
              </p>
            </div>

            {/* Glowing backdrop spotlight */}
            <div className="absolute top-1/2 left-1/2 h-[300px] w-[350px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-emerald-500/10 blur-[100px]" />

            {/* Overlapping Glassmorphic Grid */}
            <div className="relative mt-4 h-[360px] w-full max-w-lg">

              {/* Card 1: ARCA Factura */}
              <div className="absolute left-0 top-4 z-20 flex w-[230px] -rotate-3 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4.5 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:rotate-0 hover:border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">FE • Factura A</span>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black text-emerald-400 border border-emerald-500/20">ARCA</span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500">Total Autorizado</p>
                  <p className="font-mono text-2xl font-black text-white">$245.800</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/5 px-2 py-1 text-[9px] font-bold text-emerald-400 ring-1 ring-emerald-500/10">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  CAE Autorizado por AFIP
                </div>
              </div>

              {/* Card 2: CRM & Tracker */}
              <div className="absolute right-4 top-0 z-10 flex w-[230px] rotate-3 flex-col gap-3.5 rounded-2xl border border-white/10 bg-slate-900/60 p-4.5 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:rotate-0 hover:border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Presupuesto #1904</span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[8px] font-black text-blue-400 border border-blue-500/20 flex items-center gap-1">
                    <Clock size={10} /> Leído 👀
                  </span>
                </div>

                {/* Visual Pipeline */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold text-slate-500">
                    <span>Progreso de Venta</span>
                    <span className="text-emerald-400">80%</span>
                  </div>
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div className="h-full w-[80%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] font-black text-slate-400">
                  <span>Enviado ✅</span>
                  <span>Visto 👀</span>
                  <span className="text-white/30">Cobrado 💰</span>
                </div>
              </div>

              {/* Card 3: Sellers conversion */}
              <div className="absolute bottom-6 left-6 z-10 flex w-[230px] rotate-2 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4.5 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:rotate-0 hover:border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fuerza de Ventas</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between rounded-lg bg-white/5 p-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-500/20 text-[9px] font-black text-emerald-400 flex items-center justify-center">YZ</div>
                      <span className="text-[10px] font-bold text-white">Vendedor 1</span>
                    </div>
                    <span className="text-[10px] font-mono font-black text-emerald-400">82% Conv.</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-white/5 p-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded-full bg-indigo-500/20 text-[9px] font-black text-indigo-400 flex items-center justify-center">NS</div>
                      <span className="text-[10px] font-bold text-white">Vendedor 2</span>
                    </div>
                    <span className="text-[10px] font-mono font-black text-slate-400">75% Conv.</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Accountant & Reports */}
              <div className="absolute bottom-0 right-0 z-20 flex w-[230px] -rotate-2 flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-4.5 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 hover:rotate-0 hover:border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Portal de Contador</span>
                </div>
                <p className="text-[10px] font-semibold text-slate-500 leading-relaxed">
                  Reportes impositivos listos para AFIP.
                </p>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600/10 border border-emerald-500/20 py-2 text-[10px] font-extrabold text-emerald-400 transition-colors hover:bg-emerald-600 hover:text-white"
                >
                  <Download size={12} />
                  Exportar Libro IVA
                </button>
              </div>

            </div>
          </div>

          {/* Bottom Trust Badge */}
          <div className="relative z-10 flex items-center justify-between border-t border-white/5 pt-6">
            <p className="text-xs font-bold text-slate-500">
              Unite a la comunidad de <span className="text-white">líderes IT</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-emerald-400">Plataforma Asegurada</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur">
                <TrendingUp className="text-emerald-500 animate-pulse" size={14} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}