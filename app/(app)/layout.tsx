import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Wallet,
  Settings,
} from 'lucide-react'
import LogoutButton from '../components/LogoutButton'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/clientes', label: 'Clientes', icon: Users },
    { href: '/productos', label: 'Productos', icon: Package },
    { href: '/presupuestos', label: 'Presupuestos', icon: FileText },
    { href: '/cuenta-corriente', label: 'Cuenta corriente', icon: Wallet },
    { href: '/configuracion', label: 'Configuración', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-slate-200 bg-slate-950 text-white lg:block">
        <div className="flex h-20 items-center border-b border-white/10 px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">
              ERP Comercial
            </p>
            <h1 className="mt-1 text-xl font-black">Presupuestos</h1>
          </div>
        </div>

        <nav className="space-y-2 p-4">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <Icon size={19} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Sistema de gestión
              </p>
              <h2 className="text-xl font-black text-slate-900">
                Panel principal
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
                Online
              </div>

              <LogoutButton />
            </div>
          </div>
        </header>

        <section className="p-6">{children}</section>
      </main>
    </div>
  )
}