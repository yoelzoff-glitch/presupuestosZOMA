'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  Package,
  Phone,
  UserRound,
  Wrench,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type Plan = 'base' | 'pro'

type Props = {
  plans: Record<Plan, { name: string; amount: number }>
}

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

function Input({
  icon: Icon,
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      <span className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          {...props}
          className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </span>
    </label>
  )
}

export default function RegisterTrialForm({ plans }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [plan, setPlan] = useState<Plan>('pro')
  const [businessType, setBusinessType] = useState<'products' | 'services'>('products')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyCuit, setCompanyCuit] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const firstChargeDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + 14)
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [])

  function validateAccount() {
    if (!fullName.trim() || !companyName.trim() || !email.trim()) {
      return 'Completa tu nombre, empresa y correo.'
    }
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
    if (password !== confirmPassword) return 'Las contraseñas no coinciden.'
    if (!acceptedTerms) return 'Debes aceptar los términos y la política de privacidad.'
    return ''
  }

  function continueToPlan() {
    const message = validateAccount()
    if (message) {
      setError(message)
      return
    }
    setError('')
    setStep(2)
  }

  async function startCheckout() {
    setLoading(true)
    setError('')

    try {
      const { data: current } = await supabase.auth.getUser()
      let user = current.user

      if (!user) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { full_name: fullName.trim() } },
        })
        if (signUpError || !data.user) {
          throw new Error(signUpError?.message || 'No pudimos crear tu usuario.')
        }
        if (!data.session) {
          throw new Error(
            'Revisa tu correo para confirmar la cuenta. Luego inicia sesión y vuelve a continuar.'
          )
        }
        user = data.user
      }

      if (user.email?.toLowerCase() !== email.trim().toLowerCase()) {
        throw new Error('La sesión abierta pertenece a otro correo. Cierra sesión e intenta nuevamente.')
      }

      const storageKey = `zoma-onboarding-key:${user.id}`
      let idempotencyKey = localStorage.getItem(storageKey)
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID()
        localStorage.setItem(storageKey, idempotencyKey)
      }

      const response = await fetch('/api/auth/register-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          company_name: companyName.trim(),
          company_cuit: companyCuit.trim(),
          company_phone: companyPhone.trim(),
          business_type: businessType,
          plan_type: plan,
          idempotency_key: idempotencyKey,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No pudimos iniciar el checkout.')

      if (body.redirect_to) {
        router.replace(body.redirect_to)
        return
      }
      if (!body.checkout_url) throw new Error('Mercado Pago no devolvió el checkout.')
      window.location.assign(body.checkout_url)
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : 'No pudimos continuar con el registro.'
      )
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-extrabold tracking-tight">
            ZOMA <span className="text-emerald-700">ERP</span>
          </Link>
          <Link href="/auth/login" className="text-sm font-semibold text-slate-600 hover:text-slate-950">
            Ya tengo una cuenta
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[1fr_340px] lg:py-12">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-7 flex items-center gap-3 border-b border-slate-200 pb-5">
            {[1, 2].map((item) => (
              <div key={item} className="flex flex-1 items-center gap-2">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${step >= item ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {step > item ? <Check size={16} /> : item}
                </span>
                <span className={`text-sm font-semibold ${step >= item ? 'text-slate-900' : 'text-slate-400'}`}>
                  {item === 1 ? 'Cuenta y empresa' : 'Plan y autorización'}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="grid gap-5">
              <div>
                <h1 className="text-2xl font-extrabold">Crea tu espacio de trabajo</h1>
                <p className="mt-1 text-sm text-slate-600">Usaremos estos datos para crear el administrador y su empresa.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input icon={UserRound} label="Nombre y apellido" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                <Input icon={Building2} label="Nombre de la empresa" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                <Input icon={Mail} label="Correo administrativo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <Input icon={Phone} label="Teléfono" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} autoComplete="tel" />
                <Input icon={Building2} label="CUIT" value={companyCuit} onChange={(e) => setCompanyCuit(e.target.value)} inputMode="numeric" />
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Actividad principal
                  <span className="grid grid-cols-2 rounded-md border border-slate-300 bg-slate-50 p-1">
                    <button type="button" onClick={() => setBusinessType('products')} className={`flex h-9 items-center justify-center gap-2 rounded text-xs font-bold ${businessType === 'products' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>
                      <Package size={16} /> Productos
                    </button>
                    <button type="button" onClick={() => setBusinessType('services')} className={`flex h-9 items-center justify-center gap-2 rounded text-xs font-bold ${businessType === 'services' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'}`}>
                      <Wrench size={16} /> Servicios
                    </button>
                  </span>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Contraseña
                  <span className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-10 text-sm" />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                <Input icon={LockKeyhole} label="Repetir contraseña" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </div>

              <label className="flex items-start gap-3 text-sm text-slate-600">
                <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-700" />
                <span>Acepto los <Link className="font-semibold text-emerald-800 underline" href="/terminos" target="_blank">términos</Link> y la <Link className="font-semibold text-emerald-800 underline" href="/privacidad" target="_blank">política de privacidad</Link>.</span>
              </label>

              <button type="button" onClick={continueToPlan} className="ml-auto flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800">
                Continuar <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              <div>
                <h1 className="text-2xl font-extrabold">Elige el plan que vas a probar</h1>
                <p className="mt-1 text-sm text-slate-600">Mercado Pago solicitará una tarjeta, pero hoy no realizará ningún cobro.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(plans) as Plan[]).map((planId) => (
                  <button key={planId} type="button" onClick={() => setPlan(planId)} className={`rounded-lg border p-5 text-left transition ${plan === planId ? 'border-emerald-700 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-slate-400'}`}>
                    <span className="flex items-center justify-between">
                      <span className="font-extrabold">{plans[planId].name}</span>
                      <span className={`grid h-5 w-5 place-items-center rounded-full border ${plan === planId ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300'}`}>
                        {plan === planId && <Check size={13} />}
                      </span>
                    </span>
                    <span className="mt-5 block text-2xl font-extrabold">{money.format(plans[planId].amount)}</span>
                    <span className="text-xs font-medium text-slate-500">por mes después de la prueba</span>
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex gap-3">
                  <CreditCard className="mt-0.5 text-emerald-800" size={22} />
                  <div className="text-sm text-slate-700">
                    <p className="font-extrabold text-slate-950">Prueba gratuita de 14 días</p>
                    <p className="mt-1">Primer cobro: <b>{firstChargeDate}</b>.</p>
                    <p>Monto: <b>{money.format(plans[plan].amount)}</b> por mes.</p>
                    <p className="mt-2 text-xs">Los datos de tarjeta se cargan directamente en Mercado Pago y no pasan por ZOMA.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setStep(1)} disabled={loading} className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-bold text-slate-600 hover:bg-slate-100">
                  <ArrowLeft size={17} /> Volver
                </button>
                <button type="button" onClick={startCheckout} disabled={loading} className="flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
                  Autorizar en Mercado Pago
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="h-fit rounded-lg border border-slate-800 bg-slate-950 p-6 text-white lg:sticky lg:top-6">
          <p className="text-xs font-bold uppercase text-emerald-400">Resumen</p>
          <h2 className="mt-2 text-xl font-extrabold">14 días para probar ZOMA</h2>
          <ul className="mt-5 grid gap-3 text-sm text-slate-300">
            {['Acceso inmediato después de autorizar', 'Tenant aislado para tu empresa', 'Sin cobro durante la prueba', 'Cancelación antes del primer cobro'].map((item) => (
              <li key={item} className="flex gap-2"><Check className="shrink-0 text-emerald-400" size={17} /> {item}</li>
            ))}
          </ul>
          <div className="mt-6 border-t border-slate-800 pt-5 text-xs leading-relaxed text-slate-400">
            La activación depende de la confirmación de Mercado Pago. Si se demora, la pantalla de retorno actualizará el estado automáticamente.
          </div>
        </aside>
      </div>
    </main>
  )
}
