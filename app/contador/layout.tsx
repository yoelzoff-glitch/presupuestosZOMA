'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ShieldCheck, LogOut, User as UserIcon } from 'lucide-react'
import GlobalChatBubble from '@/app/components/GlobalChatBubble'

export default function ContadorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data: profile } = await supabase
        .from('users_profiles')
        .select('*, companies(name)')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'contador' && profile.role !== 'admin')) {
        router.push('/auth/login')
        return
      }

      setProfile(profile)
      setLoading(false)
    }

    checkUser()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Superior del Estudio Contable */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 font-black">
              Z
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 leading-none">Estudio Contable</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{profile?.companies?.name || 'ZOMA Tech'}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Perfil Mini */}
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-xs font-black text-slate-900">{profile?.full_name}</p>
                <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${profile?.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  {profile?.role === 'admin' ? 'Administrador' : 'Contador Externo'}
                </span>
              </div>
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 overflow-hidden">
                <UserIcon size={20} />
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
              title="Cerrar sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Chat Global para soporte contable directo */}
      <GlobalChatBubble />
    </div>
  )
}
