'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Lock, ChevronRight, CheckCircle2 } from 'lucide-react'

export default function UpdatePassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    // Verificar si venimos de un link de recuperación
    const checkSession = async () => {
      // Damos un pequeño respiro para que el cliente de Supabase procese el hash de la URL
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        // Si después de un momento no hay sesión, mostramos el error
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (!retrySession) {
            setErrorMsg('El enlace de recuperación no es válido o ha expirado. Por favor, solicitá uno nuevo.')
          }
        }, 500)
      }
    }
    checkSession()
  }, [])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({
      password: password
    })

    setLoading(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }

    setSuccessMsg('¡Contraseña actualizada con éxito!')
    setTimeout(() => {
      router.replace('/auth/login')
    }, 2000)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
      
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-black tracking-tight text-white">
              Nueva Contraseña
            </h2>
            <p className="mt-3 font-medium text-slate-500">
              Ingresá tu nueva clave de acceso.
            </p>
          </div>

          <form
            onSubmit={handleUpdate}
            className="space-y-6 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl lg:p-10"
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

            <button
              type="submit"
              disabled={loading || !!successMsg}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-70"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Restablecer contraseña
                  <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
