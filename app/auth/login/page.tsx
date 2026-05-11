'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Lock, Mail, ChevronRight } from 'lucide-react'

export default function Login() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg('')

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Completá usuario/email y contraseña.')
      return
    }

    setLoading(true)
    const loginValue = email.trim().toLowerCase()
    const loginEmail = loginValue.includes('@')
      ? loginValue
      : `${loginValue}@clientes.local`

    const { data: loginData, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error || !loginData.user) {
      setLoading(false)
      setErrorMsg('Usuario/email o contraseña incorrectos.')
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('id', loginData.user.id)
      .single()

    setLoading(false)

    if (profileError || !profile) {
      setErrorMsg('No se encontró el perfil del usuario.')
      await supabase.auth.signOut()
      return
    }

    if (profile.role === 'customer') {
      router.replace('/portal')
      router.refresh()
      return
    }

    if (profile.role === 'vendedor') {
      router.replace('/vendedor')
      router.refresh()
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {/* Background Decorative Elements */}
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="absolute -right-24 bottom-0 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[150px]" />

      <div className="relative flex min-h-screen">
        {/* Left Side: Visual/Branding */}
        <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
          <div className="absolute inset-0 z-0 opacity-40">
            <div
              className="h-full w-full"
              style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 40%, #1e1b4b 70%, #0f172a 100%)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/40">
                <Lock className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">
                ZOMA <span className="text-blue-500">ERP</span>
              </span>
            </div>
          </div>

          <div className="relative z-10">
            <h1 className="text-6xl font-black leading-[1.1] tracking-tight">
              Gestioná tu empresa <br />
              con <span className="text-blue-500 underline decoration-blue-500/30 underline-offset-8">inteligencia.</span>
            </h1>
            <p className="mt-8 max-w-lg text-lg font-medium leading-relaxed text-slate-400">
              La plataforma definitiva para presupuestos, ventas y cuentas corrientes. 
              Simple para tus clientes, potente para tu equipo.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-8">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 w-12 rounded-full border-4 border-[#020617] bg-slate-800 ring-2 ring-blue-500/20" />
              ))}
            </div>
            <p className="text-sm font-bold text-slate-400">
              Más de <span className="text-white">100+ empresas</span> confían en nosotros
            </p>
          </div>
        </section>

        {/* Right Side: Login Form */}
        <section className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="mb-10 text-center lg:text-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-400 ring-1 ring-blue-400/20">
                Acceso exclusivo
              </div>
              <h2 className="text-4xl font-black tracking-tight text-white">
                ¡Hola de nuevo!
              </h2>
              <p className="mt-3 font-medium text-slate-500">
                Ingresá tus credenciales para acceder al panel.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="space-y-6 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl lg:p-10"
            >
              {errorMsg && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  {errorMsg}
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Email o Usuario
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-500">
                      <Mail size={20} />
                    </div>
                    <input
                      type="text"
                      value={email}
                      placeholder="ej: juanperez o mail@ejemplo.com"
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Contraseña
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-500">
                      <Lock size={20} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="••••••••"
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-12 text-sm font-bold text-white outline-none transition-all focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10"
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Ingresar al sistema
                    <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="pt-4 text-center">
                <p className="text-sm font-bold text-slate-500">
                  ¿No tenés cuenta?{' '}
                  <Link
                    href="/auth/register"
                    className="text-blue-400 transition-colors hover:text-blue-300"
                  >
                    Registrá tu empresa
                  </Link>
                </p>
              </div>
            </form>

            <p className="mt-12 text-center text-xs font-bold uppercase tracking-widest text-slate-600">
              &copy; {new Date().getFullYear()} ZOMA TECHNOLOGY &bull; V2.0
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}