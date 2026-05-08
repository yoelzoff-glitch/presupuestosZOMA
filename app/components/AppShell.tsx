'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import LogoutButton from '@/app/components/LogoutButton'
import NotificationsBell from '@/app/components/NotificationsBell'

type AppShellProps = {
  children: React.ReactNode
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/productos', label: 'Productos', icon: Package },
  { href: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { href: '/presupuestos', label: 'Presupuestos', icon: FileText },
  { href: '/cuenta-corriente', label: 'Cuenta corriente', icon: Wallet },
  { href: '/notificaciones', label: 'Notificaciones', icon: Bell },
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
  if (pathname.startsWith('/pedidos')) return 'Carga de pedidos sin valores para convertir luego en presupuestos'
  if (pathname.startsWith('/presupuestos')) return 'Creación y seguimiento de presupuestos'
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center border-b border-white/10 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
            <Sparkles size={20} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">
              ZOMA
            </p>
            <h1 className="mt-1 text-xl font-black text-white">
              Clientes
            </h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActiveRoute(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? 'bg-white text-slate-950 shadow-lg shadow-black/20'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-slate-300 group-hover:bg-white/10 group-hover:text-white'
                }`}
              >
                <Icon size={18} />
              </span>

              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-4 space-y-4">
        <a
          href="https://wa.me/5491100000000?text=Hola,%20necesito%20ayuda%20o%20soporte%20técnico%20con%20el%20sistema"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-blue-600/20 text-blue-400 px-4 py-3 text-sm font-bold transition hover:bg-blue-600 hover:text-white"
        >
          <LifeBuoy size={18} />
          Soporte Técnico
        </a>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Estado
          </p>

          <div className="mt-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
            <span className="text-sm font-bold text-white">Online</span>
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Sistema listo para gestionar pedidos, presupuestos, productos y clientes.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const title = getPageTitle(pathname)
  const description = getPageDescription(pathname)

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 border-r border-white/10 bg-slate-950 text-white lg:block">
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
    </div>
  )
}