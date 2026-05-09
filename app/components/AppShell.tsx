'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Wallet,
  Settings,
  Menu,
  X,
  Sparkles,
  ClipboardList,
  Bell,
  LifeBuoy,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import LogoutButton from '@/app/components/LogoutButton'
import NotificationsBell from '@/app/components/NotificationsBell'
import GlobalChatBubble from '@/app/components/GlobalChatBubble'

type AppShellProps = {
  children: React.ReactNode
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/presupuestos', label: 'Presupuestos', icon: FileText },
  { href: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { href: '/cuenta-corriente', label: 'Cuenta corriente', icon: Wallet },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

function getPageTitle(pathname: string) {
  if (pathname === '/') return 'Dashboard'
  if (pathname.startsWith('/clientes')) return 'Clientes'
  if (pathname.startsWith('/productos')) return 'Productos'
  if (pathname.startsWith('/pedidos')) return 'Pedidos'
  if (pathname.startsWith('/presupuestos')) return 'Presupuestos'
  if (pathname.startsWith('/cuenta-corriente')) return 'Cuenta corriente'
  if (pathname.startsWith('/notificaciones')) return 'Notificaciones'
  if (pathname.startsWith('/configuracion')) return 'Configuración'

  return 'Panel principal'
}

function getPageDescription(pathname: string) {
  if (pathname === '/') return 'Resumen general de la gestión comercial'
  if (pathname.startsWith('/clientes')) return 'Administración de clientes y datos comerciales'
  if (pathname.startsWith('/productos')) return 'Gestión de productos, precios y catálogo'
  if (pathname.startsWith('/presupuestos')) return 'Creación de propuestas comerciales'
  if (pathname.startsWith('/pedidos')) return 'Gestión de órdenes de venta confirmadas'
  if (pathname.startsWith('/cuenta-corriente')) return 'Control de saldos y movimientos'
  if (pathname.startsWith('/notificaciones')) return 'Avisos importantes del sistema'
  if (pathname.startsWith('/configuracion')) return 'Parámetros generales del sistema'

  return 'Sistema de gestión'
}

function isActiveRoute(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users_profiles')
          .select('role, company:companies(plan_type)')
          .eq('id', user.id)
          .single()
        setProfile(data)
      }
      setLoading(false)
    }
    getProfile()
  }, [])

  const isAdmin = profile?.role === 'admin'

  const planType = profile?.company?.plan_type || 'base'
  const isPro = planType === 'pro' || planType === 'pro_plus'

  const filteredNavItems = navItems.filter((item) => {
    if (loading) return false
    
    // Si no es PRO, ocultar Vendedores del menú
    if (item.href === '/vendedores' && !isPro) return false

    // Vendedores cannot see Account Current, Settings or Sellers management
    if (profile?.role === 'vendedor') {
      const hiddenForVendedores = ['/productos', '/cuenta-corriente', '/configuracion', '/vendedores']
      return !hiddenForVendedores.includes(item.href)
    }
    return true
  })

  // Add Vendedores to navItems for Admin
  const finalNavItems = isAdmin 
    ? [...navItems.slice(0, 2), { href: '/vendedores', label: 'Vendedores', icon: Users }, ...navItems.slice(2)]
    : filteredNavItems

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center px-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-xl shadow-blue-500/20">
            <Sparkles size={20} />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400/80">
              SISTEMA
            </p>
            <h1 className="text-xl font-black tracking-tight text-white">
              ZOMA<span className="text-blue-500">.</span>
            </h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20">
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-slate-700" size={20} />
          </div>
        ) : (
          finalNavItems.map((item) => {
            const Icon = item.icon
            const active = isActiveRoute(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-bold transition-all duration-300 ${
                  active
                    ? 'bg-blue-600/10 text-white'
                    : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                }`}
              >
                {active && (
                  <div className="absolute left-0 h-5 w-1 rounded-r-full bg-blue-500" />
                )}

                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'bg-white/[0.03] text-slate-500 group-hover:bg-white/[0.08] group-hover:text-slate-300'
                  }`}
                >
                  <Icon size={18} strokeWidth={2.5} />
                </span>

                <span className="tracking-tight">{item.label}</span>
              </Link>
            )
          })
        )}
      </nav>

      <div className="p-4 space-y-3">
        <a
          href="https://wa.me/5491100000000?text=Hola,%20necesito%20ayuda%20o%20soporte%20técnico%20con%20el%20sistema"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-white/[0.03] border border-white/5 text-slate-300 px-4 py-2.5 text-xs font-bold transition hover:bg-blue-600 hover:text-white hover:border-blue-600"
        >
          <LifeBuoy size={16} />
          Soporte Técnico
        </a>

        <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Estado
            </p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-wider">Online</span>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed font-medium text-slate-500">
            Sistema activo y sincronizado con la nube.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [planType, setPlanType] = useState<string | null>(null)

  useEffect(() => {
    async function getPlan() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('users_profiles')
          .select('company_id, company:companies(plan_type)')
          .eq('id', user.id)
          .single()
        
        // Ahora que la columna existe, volvemos a la lógica real de planes
        const rawPlan = (data?.company as any)?.plan_type
        setPlanType(rawPlan || 'base')
      }
    }
    getPlan()
  }, [])

  const title = getPageTitle(pathname)
  const description = getPageDescription(pathname)

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 border-r border-white/5 bg-slate-950 text-white lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-80 max-w-[86vw] border-r border-white/10 bg-slate-950 text-white shadow-2xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute right-4 top-4">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <SidebarContent onNavigate={() => setMobileOpen(false)} />
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 px-4 py-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
                aria-label="Abrir menú"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-500">
                  {description}
                </p>
                <h2 className="truncate text-xl font-black text-slate-900 sm:text-2xl">
                  {title}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationsBell />

              <div className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 shadow-sm md:block">
                Online
              </div>

              <div className="hidden sm:block">
                <LogoutButton />
              </div>
            </div>
          </div>
        </header>

        <section className="p-4 sm:p-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </section>
      </main>

      {/* Burbuja de Chat Global - Solo para planes PRO o superior */}
      {(planType === 'pro' || planType === 'pro_plus') && <GlobalChatBubble />}
    </div>
  )
}