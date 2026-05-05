'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { ClipboardList, Package, LogOut } from 'lucide-react'

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

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

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-black text-slate-950">
              Portal cliente
            </h1>
            <p className="text-xs font-semibold text-slate-500">
              Lista de precios y pedidos
            </p>
          </div>

          <nav className="flex items-center gap-2">
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

            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-red-50 hover:text-red-600"
            >
              <LogOut size={16} />
              Salir
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5">
        {children}
      </div>
    </main>
  )
}