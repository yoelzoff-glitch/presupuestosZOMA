'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ClipboardList, 
  LogOut,
  Menu,
  X,
  ShieldCheck,
  User as UserIcon,
  Bell
} from 'lucide-react'
import NotificationsBell from '@/app/components/NotificationsBell'
import GlobalChatBubble from '@/app/components/GlobalChatBubble'

export default function VendedorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
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

      if (!profile || (profile.role !== 'vendedor' && profile.role !== 'admin')) {
        router.push('/auth/login')
        return
      }

      setProfile(profile)
      setLoading(false)
    }

    checkUser()
  }, [router])

  const navItems = [
    { href: '/vendedor', label: 'Inicio', icon: LayoutDashboard },
    { href: '/vendedor/clientes', label: 'Clientes', icon: Users },
    { href: '/vendedor/presupuestos', label: 'Presupuestos', icon: FileText },
    { href: '/vendedor/pedidos', label: 'Pedidos', icon: ClipboardList },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Superior para Móvil y Desktop */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 font-black">
                Z
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-black text-slate-900 leading-none">Portal Vendedores</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{profile?.companies?.name || 'ZOMA Tech'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Notificaciones */}
            <NotificationsBell />

            {/* Perfil Mini */}
            <div className="flex items-center gap-3 pl-4 border-l border-slate-100">
               <div className="hidden text-right sm:block">
                 <p className="text-xs font-black text-slate-900">{profile?.full_name}</p>
                 <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${profile?.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {profile?.role === 'admin' ? 'Admin' : 'Vendedor'}
                 </span>
               </div>
               <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 overflow-hidden">
                  <UserIcon size={20} />
               </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Desktop */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <nav className="sticky top-24 space-y-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/vendedor' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-black transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 translate-x-1'
                        : 'text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
                    }`}
                  >
                    <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                    {item.label}
                  </Link>
                )
              })}
              
              <div className="pt-4 mt-4 border-t border-slate-200">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-black text-slate-500 transition-all hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut size={20} />
                  Cerrar sesión
                </button>
              </div>
            </nav>
          </aside>

          {/* Contenido Principal */}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>

      {/* Menú Móvil Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden">
          <div className="absolute left-0 top-0 h-full w-72 bg-white p-6 shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="mb-10 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-black">Z</div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50">
                <X size={24} />
              </button>
            </div>
            
            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-2xl px-4 py-4 text-base font-black text-slate-600 hover:bg-slate-50"
                >
                  <item.icon size={22} />
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="mt-6 flex w-full items-center gap-3 rounded-2xl bg-red-50 px-4 py-4 text-base font-black text-red-600"
              >
                <LogOut size={22} />
                Cerrar sesión
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Navegación Inferior (Móvil) */}
      <nav className="fixed bottom-0 left-0 z-40 flex w-full border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden px-4 pb-safe-offset-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/vendedor' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center py-3 transition-all ${
                isActive ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <item.icon size={22} strokeWidth={isActive ? 3 : 2} />
              <span className="mt-1 text-[10px] font-black uppercase tracking-widest">{item.label}</span>
              {isActive && <div className="mt-1 h-1 w-1 rounded-full bg-blue-600" />}
            </Link>
          )
        })}
      </nav>

      {/* Chat Global */}
      <GlobalChatBubble />
    </div>
  )
}
