'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Lock, Mail, Building2, ChevronRight, CheckCircle2 } from 'lucide-react'

export default function Register() {
  const router = useRouter()


  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!companyName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Completá todos los campos.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
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
          <div className="absolute inset-0 z-0 opacity-40">
            <div
              className="h-full w-full"
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 40%, #1e1b4b 70%, #0f172a 100%)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/40">
                <CheckCircle2 className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">
                ZOMA <span className="text-emerald-500">ERP</span>
              </span>
            </div>
          </div>

          <div className="relative z-10 text-right">
            <h1 className="text-6xl font-black leading-[1.1] tracking-tight">
              Escalá tu negocio <br />
              sin <span className="text-emerald-500 underline decoration-emerald-500/30 underline-offset-8">límites.</span>
            </h1>
            <p className="mt-8 ml-auto max-w-lg text-lg font-medium leading-relaxed text-slate-400">
              Registrate en segundos y empezá a profesionalizar tu gestión comercial. 
              Todo lo que necesitás en un solo lugar.
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-end gap-8">
            <p className="text-sm font-bold text-slate-400">
              Unite a la comunidad de <span className="text-white">líderes IT</span>
            </p>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur">
                <ChevronRight className="text-emerald-500" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}