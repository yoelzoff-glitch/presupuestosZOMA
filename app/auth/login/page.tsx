'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'

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

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="hidden flex-col justify-between border-r border-white/10 bg-slate-900/60 p-10 lg:flex">
          <div>
            <div className="inline-flex rounded-2xl bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-300 ring-1 ring-blue-400/20">
              Sistema de presupuestos
            </div>

            <h1 className="mt-8 max-w-xl text-5xl font-black tracking-tight">
              Gestión simple, rápida y profesional.
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Cargá clientes, productos y presupuestos desde una plataforma
              clara, moderna y preparada para trabajar en equipo.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-blue-950/30 backdrop-blur">
            <p className="text-sm text-slate-400">Acceso seguro</p>
            <p className="mt-2 text-2xl font-bold">Presupuestos ZOMA</p>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-7 text-slate-950 shadow-2xl"
          >
            <div className="mb-8">
              <p className="text-sm font-semibold text-blue-600">
                Bienvenido de nuevo
              </p>
              <h2 className="mt-2 text-3xl font-black">Iniciar sesión</h2>
              <p className="mt-2 text-sm text-slate-500">
                Ingresá con tu email o usuario y contraseña.
              </p>
            </div>

            {errorMsg && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Email o usuario
                </span>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <Mail size={18} className="text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    placeholder="tuemail@gmail.com o cliente1"
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Contraseña
                </span>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
                  <Lock size={18} className="text-slate-400" />

                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    placeholder="••••••••"
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}