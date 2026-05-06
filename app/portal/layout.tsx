'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  ClipboardList,
  Package,
  LogOut,
  Wallet,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function logout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function navClass(href: string) {
    const active = pathname === href

    return `flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
    }`
  }

  function closeMobile() {
    setMobileOpen(false)
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black text-slate-950">
              Portal cliente
            </h1>
            <p className="truncate text-xs font-semibold text-slate-500">
              Lista de precios, pedidos y cuenta corriente
            </p>
          </div>

          <nav className="hidden items-center gap-2 lg:flex">
            <Link href="/portal" className={navClass('/portal')}>
              <Package size={16} />
              Lista de precios
            </Link>

            <Link
              href="/portal/pedidos"
              className={navClass('/portal/pedidos')}
            >
              <ClipboardList size={16} />
              Mis pedidos
            </Link>

            <Link
              href="/portal/cuenta-corriente"
              className={navClass('/portal/cuenta-corriente')}
            >
              <Wallet size={16} />
              Cuenta corriente
            </Link>

            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={16} />
              Salir
            </button>
          </nav>

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-50 h-screen w-80 max-w-[86vw] bg-white p-4 shadow-2xl transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-black text-slate-950">Portal cliente</h2>
            <p className="text-xs font-semibold text-slate-500">
              Menú principal
            </p>
          </div>

          <button
            type="button"
            onClick={closeMobile}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="space-y-2">
          <Link href="/portal" onClick={closeMobile} className={navClass('/portal')}>
            <Package size={16} />
            Lista de precios
          </Link>

          <Link
            href="/portal/pedidos"
            onClick={closeMobile}
            className={navClass('/portal/pedidos')}
          >
            <ClipboardList size={16} />
            Mis pedidos
          </Link>

          <Link
            href="/portal/cuenta-corriente"
            onClick={closeMobile}
            className={navClass('/portal/cuenta-corriente')}
          >
            <Wallet size={16} />
            Cuenta corriente
          </Link>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} />
            Salir
          </button>
        </nav>
      </aside>

      <div className="mx-auto max-w-7xl px-4 py-5">
        {children}
      </div>
    </main>
  )
}