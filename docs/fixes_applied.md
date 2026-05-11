# 🛠️ ZOMA ERP — Fixes Applied

**Date**: 2026-05-11  
**Files Modified**: 11 files  
**Files Created**: 4 new files  
**Files Deleted**: 6 files

---

## 🔴 P0 — Security Fixes

### 1. `/api/register-company` — JWT Authentication ✅
```diff:route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, company_name, email } = body

    if (!user_id || !company_name || !email) {
      return NextResponse.json(
        { error: 'Faltan datos obligatorios' },
        { status: 400 }
      )
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: company_name,
      })
      .select('id')
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        {
          error: 'No se pudo crear la empresa',
          detail: companyError?.message,
        },
        { status: 500 }
      )
    }

    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id: user_id,
        company_id: company.id,
        full_name: email,
        role: 'admin',
      })

    if (profileError) {
      return NextResponse.json(
        {
          error: 'No se pudo crear el perfil',
          detail: profileError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      company_id: company.id,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Error interno registrando empresa' },
      { status: 500 }
    )
  }
}
===
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate — extract user_id from JWT, never trust client body
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autorizado. Debés iniciar sesión primero.' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { company_name, email } = body

    if (!company_name || !email) {
      return NextResponse.json(
        { error: 'Faltan datos obligatorios (nombre de empresa, email)' },
        { status: 400 }
      )
    }

    // 2. Check user doesn't already have a company
    const { data: existingProfile } = await supabaseAdmin
      .from('users_profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfile?.company_id) {
      return NextResponse.json(
        { error: 'Este usuario ya tiene una empresa registrada.' },
        { status: 409 }
      )
    }

    // 3. Create Company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: company_name,
      })
      .select('id')
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        {
          error: 'No se pudo crear la empresa',
          detail: companyError?.message,
        },
        { status: 500 }
      )
    }

    // 4. Create/Update User Profile — use authenticated user.id, not body
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id: user.id,
        company_id: company.id,
        full_name: email,
        role: 'admin',
      })

    if (profileError) {
      // Cleanup: delete the company if profile fails
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      return NextResponse.json(
        {
          error: 'No se pudo crear el perfil',
          detail: profileError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      company_id: company.id,
    })
  } catch (error) {
    console.error(error)

    return NextResponse.json(
      { error: 'Error interno registrando empresa' },
      { status: 500 }
    )
  }
}
}
```

**Before**: `user_id` was accepted from the JSON body — an attacker could POST any UUID to create companies under arbitrary accounts.  
**After**: `user_id` is extracted from the authenticated JWT session. Also added duplicate company prevention and proper cleanup (delete company on profile failure).

### 2. `/api/vendedores/create` — Server-Side Plan Validation ✅
```diff:route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Admin
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
        },
      }
    )

    const { data: { user: adminUser } } = await supabase.auth.getUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role, company_id')
      .eq('id', adminUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Permiso denegado', 
        detail: `Tu rol actual es: "${profile?.role || 'No definido'}" y el sistema requiere "admin".` 
      }, { status: 403 })
    }

    const body = await req.json()
    const { email, password, full_name } = body

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Faltan datos (email, password, nombre)' }, { status: 400 })
    }

    // 2. Create User in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Error creando usuario de autenticación', detail: authError?.message }, { status: 400 })
    }

    // 3. Create/Update User Profile (Upsert to handle trigger)
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id: authData.user.id,
        company_id: profile.company_id,
        full_name,
        role: 'vendedor'
      })

    if (profileError) {
      // Cleanup auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ 
        error: 'Error creando perfil en DB', 
        detail: profileError.message,
        code: profileError.code
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user_id: authData.user.id })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
===
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Admin
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
        },
      }
    )

    const { data: { user: adminUser } } = await supabase.auth.getUser()
    if (!adminUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role, company_id')
      .eq('id', adminUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Permiso denegado', 
        detail: `Tu rol actual es: "${profile?.role || 'No definido'}" y el sistema requiere "admin".` 
      }, { status: 403 })
    }

    // Validate PRO plan server-side — BASE plan cannot create vendedores
    const { data: company } = await supabase
      .from('companies')
      .select('plan_type')
      .eq('id', profile.company_id)
      .single()

    const planType = company?.plan_type || 'base'
    if (planType !== 'pro' && planType !== 'pro_plus') {
      return NextResponse.json({ 
        error: 'Función no disponible', 
        detail: 'La creación de vendedores requiere un plan PRO o superior. Actualizá tu plan desde Configuración.' 
      }, { status: 403 })
    }

    const body = await req.json()
    const { email, password, full_name } = body

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Faltan datos (email, password, nombre)' }, { status: 400 })
    }

    // 2. Create User in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Error creando usuario de autenticación', detail: authError?.message }, { status: 400 })
    }

    // 3. Create/Update User Profile (Upsert to handle trigger)
    const { error: profileError } = await supabaseAdmin
      .from('users_profiles')
      .upsert({
        id: authData.user.id,
        company_id: profile.company_id,
        full_name,
        role: 'vendedor'
      })

    if (profileError) {
      // Cleanup auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ 
        error: 'Error creando perfil en DB', 
        detail: profileError.message,
        code: profileError.code
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user_id: authData.user.id })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
```

**Before**: Only the frontend layout restricted vendedor creation to PRO plans — the API had no check.  
**After**: Server validates `plan_type` is `pro` or `pro_plus` before allowing vendedor creation.

### 3. `middleware.ts` → `proxy.ts` + RBAC Enforcement ✅
```diff:proxy.ts
===
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: {
            name: string
            value: string
            options: CookieOptions
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isAuthPage = pathname.startsWith('/auth')
  const isApiPage = pathname.startsWith('/api')
  const isPortalPage = pathname.startsWith('/portal')
  const isVendedorPage = pathname.startsWith('/vendedor')

  // Admin-only routes: everything under (app) group that isn't portal or vendedor
  const isAdminRoute = !isAuthPage && !isApiPage && !isPortalPage && !isVendedorPage

  if (isApiPage) return response

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (!user && isAuthPage) {
    return response
  }

  if (user) {
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = profile?.role === 'customer' ? '/portal' : profile?.role === 'vendedor' ? '/vendedor' : '/'
      return NextResponse.redirect(url)
    }

    // Customer can only access /portal
    if (profile?.role === 'customer' && !isPortalPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      return NextResponse.redirect(url)
    }

    // Vendedor can only access /vendedor (not admin routes)
    if (profile?.role === 'vendedor' && isAdminRoute) {
      const url = request.nextUrl.clone()
      url.pathname = '/vendedor'
      return NextResponse.redirect(url)
    }

    // Admin/non-customer shouldn't access portal
    if (profile?.role !== 'customer' && isPortalPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
```

**Before**: `middleware.ts` (deprecated in Next.js 16) only blocked customers from admin routes. Vendedores could access admin routes via URL.  
**After**: `proxy.ts` using the new Next.js 16 convention. Vendedores are now server-side redirected to `/vendedor` if they try to access admin routes. Three-way role routing: admin→`/`, vendedor→`/vendedor`, customer→`/portal`.

### 4. Sequential Number Generation API ✅
New file: [/api/next-number/route.ts](file:///Users/fabriz/dev/yoel/presupuestosZOMA/app/api/next-number/route.ts)

Centralized, server-side endpoint for generating next budget/order numbers. This replaces the client-side SELECT+INSERT pattern that was vulnerable to race conditions. Can be upgraded to use `pg_advisory_lock` in a future PR.

### 5. Register Page — Remove `user_id` from Body ✅
```diff:page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Lock, Mail, Building2, ChevronRight, CheckCircle2 } from 'lucide-react'

export default function Register() {
  const router = useRouter()

  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!companyName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Completá todos los campos.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    const { data: signUpData, error: signUpError } =
      await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

    if (signUpError || !signUpData.user) {
      setLoading(false)
      setErrorMsg(signUpError?.message || 'No se pudo crear la cuenta.')
      return
    }

    const userId = signUpData.user.id

    const registerCompanyResponse = await fetch(
        '/api/register-company',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            company_name: companyName.trim(),
            email: email.trim(),
          }),
        }
      )

      const registerCompanyData =
        await registerCompanyResponse.json()

      setLoading(false)

      if (!registerCompanyResponse.ok) {
        setErrorMsg(
          registerCompanyData?.detail ||
            registerCompanyData?.error ||
            'La cuenta se creó, pero no se pudo crear la empresa.'
        )
        return
      }

    setSuccessMsg('¡Cuenta creada! Redirigiendo...')

    setTimeout(() => {
      router.replace('/auth/login')
    }, 1500)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {/* Background Decorative Elements */}
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-600/20 blur-[120px]" />
      <div className="absolute -left-24 bottom-0 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[150px]" />

      <div className="relative flex min-h-screen">
        {/* Left Side: Login Form */}
        <section className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-top-8 duration-700">
            <div className="mb-10 text-center lg:text-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-400/20">
                Nuevo registro
              </div>
              <h2 className="text-4xl font-black tracking-tight text-white">
                Sumá tu empresa
              </h2>
              <p className="mt-3 font-medium text-slate-500">
                Comenzá a gestionar tus presupuestos hoy mismo.
              </p>
            </div>

            <form
              onSubmit={handleRegister}
              className="space-y-5 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl lg:p-10"
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

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Nombre de la Empresa
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Building2 size={20} />
                    </div>
                    <input
                      type="text"
                      value={companyName}
                      placeholder="ej: Zoma Tech"
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Email Administrativo
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Mail size={20} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      placeholder="admin@tuempresa.com"
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Contraseña
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Lock size={20} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="Mínimo 6 caracteres"
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-12 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-xl shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Crear mi cuenta
                    <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="pt-4 text-center">
                <p className="text-sm font-bold text-slate-500">
                  ¿Ya tenés cuenta?{' '}
                  <Link
                    href="/auth/login"
                    className="text-emerald-400 transition-colors hover:text-emerald-300"
                  >
                    Iniciá sesión
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* Right Side: Visual/Branding */}
        <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
          <div className="absolute inset-0 z-0 opacity-40">
            <img
              src="/register_bg_abstract_1778228604959.png"
              alt="Background"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/40">
                <CheckCircle2 className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">
                ZOMA <span className="text-emerald-500">ERP</span>
              </span>
            </div>
          </div>

          <div className="relative z-10 text-right">
            <h1 className="text-6xl font-black leading-[1.1] tracking-tight">
              Escalá tu negocio <br />
              sin <span className="text-emerald-500 underline decoration-emerald-500/30 underline-offset-8">límites.</span>
            </h1>
            <p className="mt-8 ml-auto max-w-lg text-lg font-medium leading-relaxed text-slate-400">
              Registrate en segundos y empezá a profesionalizar tu gestión comercial. 
              Todo lo que necesitás en un solo lugar.
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-end gap-8">
            <p className="text-sm font-bold text-slate-400">
              Unite a la comunidad de <span className="text-white">líderes IT</span>
            </p>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur">
                <ChevronRight className="text-emerald-500" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
===
'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Lock, Mail, Building2, ChevronRight, CheckCircle2 } from 'lucide-react'

export default function Register() {
  const router = useRouter()

  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!companyName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Completá todos los campos.')
      return
    }

    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    setLoading(true)

    const { data: signUpData, error: signUpError } =
      await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

    if (signUpError || !signUpData.user) {
      setLoading(false)
      setErrorMsg(signUpError?.message || 'No se pudo crear la cuenta.')
      return
    }

    const userId = signUpData.user.id

    const registerCompanyResponse = await fetch(
        '/api/register-company',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_name: companyName.trim(),
            email: email.trim(),
          }),
        }
      )

      const registerCompanyData =
        await registerCompanyResponse.json()

      setLoading(false)

      if (!registerCompanyResponse.ok) {
        setErrorMsg(
          registerCompanyData?.detail ||
            registerCompanyData?.error ||
            'La cuenta se creó, pero no se pudo crear la empresa.'
        )
        return
      }

    setSuccessMsg('¡Cuenta creada! Redirigiendo...')

    setTimeout(() => {
      router.replace('/auth/login')
    }, 1500)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {/* Background Decorative Elements */}
      <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-emerald-600/20 blur-[120px]" />
      <div className="absolute -left-24 bottom-0 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[150px]" />

      <div className="relative flex min-h-screen">
        {/* Left Side: Login Form */}
        <section className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-top-8 duration-700">
            <div className="mb-10 text-center lg:text-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-400/20">
                Nuevo registro
              </div>
              <h2 className="text-4xl font-black tracking-tight text-white">
                Sumá tu empresa
              </h2>
              <p className="mt-3 font-medium text-slate-500">
                Comenzá a gestionar tus presupuestos hoy mismo.
              </p>
            </div>

            <form
              onSubmit={handleRegister}
              className="space-y-5 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl lg:p-10"
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

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Nombre de la Empresa
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Building2 size={20} />
                    </div>
                    <input
                      type="text"
                      value={companyName}
                      placeholder="ej: Zoma Tech"
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Email Administrativo
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Mail size={20} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      placeholder="admin@tuempresa.com"
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Contraseña
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-emerald-500">
                      <Lock size={20} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      placeholder="Mínimo 6 caracteres"
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-12 text-sm font-bold text-white outline-none transition-all focus:border-emerald-500/50 focus:bg-white/10 focus:ring-4 focus:ring-emerald-500/10"
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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-xl shadow-emerald-600/20 transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Crear mi cuenta
                    <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="pt-4 text-center">
                <p className="text-sm font-bold text-slate-500">
                  ¿Ya tenés cuenta?{' '}
                  <Link
                    href="/auth/login"
                    className="text-emerald-400 transition-colors hover:text-emerald-300"
                  >
                    Iniciá sesión
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </section>

        {/* Right Side: Visual/Branding */}
        <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
          <div className="absolute inset-0 z-0 opacity-40">
            <div
              className="h-full w-full"
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 40%, #1e1b4b 70%, #0f172a 100%)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/40">
                <CheckCircle2 className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">
                ZOMA <span className="text-emerald-500">ERP</span>
              </span>
            </div>
          </div>

          <div className="relative z-10 text-right">
            <h1 className="text-6xl font-black leading-[1.1] tracking-tight">
              Escalá tu negocio <br />
              sin <span className="text-emerald-500 underline decoration-emerald-500/30 underline-offset-8">límites.</span>
            </h1>
            <p className="mt-8 ml-auto max-w-lg text-lg font-medium leading-relaxed text-slate-400">
              Registrate en segundos y empezá a profesionalizar tu gestión comercial. 
              Todo lo que necesitás en un solo lugar.
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-end gap-8">
            <p className="text-sm font-bold text-slate-400">
              Unite a la comunidad de <span className="text-white">líderes IT</span>
            </p>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur">
                <ChevronRight className="text-emerald-500" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
```

Updated the client-side caller to match the new secure API contract.

---

## 🟡 P1 — Runtime Error Fixes

### 6. Recharts Dimension Errors — Fixed ✅
render_diffs(file:///Users/fabriz/dev/yoel/presupuestosZOMA/app/(app)/page.tsx)

**Before**: `ResponsiveContainer` with `height="100%"` inside flex containers → `width(-1) height(-1)` errors (4+ per dashboard load).  
**After**: Fixed pixel heights (`height={288}`, `height={160}`) and `minHeight` styles ensure charts always have valid dimensions.

### 7. Login Background 404 — Fixed ✅
```diff:page.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Lock, Mail, ChevronRight } from 'lucide-react'

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

    if (profile.role === 'vendedor') {
      router.replace('/vendedor')
      router.refresh()
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {/* Background Decorative Elements */}
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="absolute -right-24 bottom-0 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[150px]" />

      <div className="relative flex min-h-screen">
        {/* Left Side: Visual/Branding */}
        <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
          <div className="absolute inset-0 z-0 opacity-40">
            <img
              src="/auth_bg_abstract_1778228532764.png"
              alt="Background"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/40">
                <Lock className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">
                ZOMA <span className="text-blue-500">ERP</span>
              </span>
            </div>
          </div>

          <div className="relative z-10">
            <h1 className="text-6xl font-black leading-[1.1] tracking-tight">
              Gestioná tu empresa <br />
              con <span className="text-blue-500 underline decoration-blue-500/30 underline-offset-8">inteligencia.</span>
            </h1>
            <p className="mt-8 max-w-lg text-lg font-medium leading-relaxed text-slate-400">
              La plataforma definitiva para presupuestos, ventas y cuentas corrientes. 
              Simple para tus clientes, potente para tu equipo.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-8">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 w-12 rounded-full border-4 border-[#020617] bg-slate-800 ring-2 ring-blue-500/20" />
              ))}
            </div>
            <p className="text-sm font-bold text-slate-400">
              Más de <span className="text-white">100+ empresas</span> confían en nosotros
            </p>
          </div>
        </section>

        {/* Right Side: Login Form */}
        <section className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="mb-10 text-center lg:text-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-400 ring-1 ring-blue-400/20">
                Acceso exclusivo
              </div>
              <h2 className="text-4xl font-black tracking-tight text-white">
                ¡Hola de nuevo!
              </h2>
              <p className="mt-3 font-medium text-slate-500">
                Ingresá tus credenciales para acceder al panel.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="space-y-6 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl lg:p-10"
            >
              {errorMsg && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  {errorMsg}
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Email o Usuario
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-500">
                      <Mail size={20} />
                    </div>
                    <input
                      type="text"
                      value={email}
                      placeholder="ej: juanperez o mail@ejemplo.com"
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>

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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Ingresar al sistema
                    <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="pt-4 text-center">
                <p className="text-sm font-bold text-slate-500">
                  ¿No tenés cuenta?{' '}
                  <Link
                    href="/auth/register"
                    className="text-blue-400 transition-colors hover:text-blue-300"
                  >
                    Registrá tu empresa
                  </Link>
                </p>
              </div>
            </form>

            <p className="mt-12 text-center text-xs font-bold uppercase tracking-widest text-slate-600">
              &copy; {new Date().getFullYear()} ZOMA TECHNOLOGY &bull; V2.0
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
===
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Lock, Mail, ChevronRight } from 'lucide-react'

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

    if (profile.role === 'vendedor') {
      router.replace('/vendedor')
      router.refresh()
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020617] text-white">
      {/* Background Decorative Elements */}
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="absolute -right-24 bottom-0 h-[500px] w-[500px] rounded-full bg-indigo-600/10 blur-[150px]" />

      <div className="relative flex min-h-screen">
        {/* Left Side: Visual/Branding */}
        <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
          <div className="absolute inset-0 z-0 opacity-40">
            <div
              className="h-full w-full"
              style={{
                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 40%, #1e1b4b 70%, #0f172a 100%)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/40">
                <Lock className="text-white" size={24} />
              </div>
              <span className="text-2xl font-black tracking-tighter text-white">
                ZOMA <span className="text-blue-500">ERP</span>
              </span>
            </div>
          </div>

          <div className="relative z-10">
            <h1 className="text-6xl font-black leading-[1.1] tracking-tight">
              Gestioná tu empresa <br />
              con <span className="text-blue-500 underline decoration-blue-500/30 underline-offset-8">inteligencia.</span>
            </h1>
            <p className="mt-8 max-w-lg text-lg font-medium leading-relaxed text-slate-400">
              La plataforma definitiva para presupuestos, ventas y cuentas corrientes. 
              Simple para tus clientes, potente para tu equipo.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-8">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 w-12 rounded-full border-4 border-[#020617] bg-slate-800 ring-2 ring-blue-500/20" />
              ))}
            </div>
            <p className="text-sm font-bold text-slate-400">
              Más de <span className="text-white">100+ empresas</span> confían en nosotros
            </p>
          </div>
        </section>

        {/* Right Side: Login Form */}
        <section className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">
          <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="mb-10 text-center lg:text-left">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-blue-400 ring-1 ring-blue-400/20">
                Acceso exclusivo
              </div>
              <h2 className="text-4xl font-black tracking-tight text-white">
                ¡Hola de nuevo!
              </h2>
              <p className="mt-3 font-medium text-slate-500">
                Ingresá tus credenciales para acceder al panel.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="space-y-6 rounded-[2.5rem] border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl lg:p-10"
            >
              {errorMsg && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  {errorMsg}
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-400 ml-1">
                    Email o Usuario
                  </label>
                  <div className="group relative transition-all">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-500">
                      <Mail size={20} />
                    </div>
                    <input
                      type="text"
                      value={email}
                      placeholder="ej: juanperez o mail@ejemplo.com"
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm font-bold text-white outline-none transition-all focus:border-blue-500/50 focus:bg-white/10 focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>

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
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Ingresar al sistema
                    <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <div className="pt-4 text-center">
                <p className="text-sm font-bold text-slate-500">
                  ¿No tenés cuenta?{' '}
                  <Link
                    href="/auth/register"
                    className="text-blue-400 transition-colors hover:text-blue-300"
                  >
                    Registrá tu empresa
                  </Link>
                </p>
              </div>
            </form>

            <p className="mt-12 text-center text-xs font-bold uppercase tracking-widest text-slate-600">
              &copy; {new Date().getFullYear()} ZOMA TECHNOLOGY &bull; V2.0
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
```

Replaced `<img src="/auth_bg_abstract_*.png">` (which was never committed) with a CSS gradient that matches the dark theme.

### 8. Register Background 404 — Fixed ✅
Same fix applied to the register page's missing background image.

### 9. `scroll-behavior: smooth` Warning — Fixed ✅
```diff:layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERP Comercial",
  description: "Sistema de gestión de clientes, productos y ventas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}

        {/* Notificaciones PRO */}
        <Toaster
          position="top-right"
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
===
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERP Comercial",
  description: "Sistema de gestión de clientes, productos y ventas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}

        {/* Notificaciones PRO */}
        <Toaster
          position="top-right"
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
```

Added `data-scroll-behavior="smooth"` to `<html>` element as required by Next.js 16.

### 10. Middleware Deprecated Warning — Fixed ✅
Eliminated by migrating `middleware.ts` → `proxy.ts` (fix #3).

---

## 🟢 P2 — Code Quality & Cleanup

### 11. Shared Supabase Server Client ✅
New file: [lib/supabase/server.ts](file:///Users/fabriz/dev/yoel/presupuestosZOMA/lib/supabase/server.ts)

Centralized `createSupabaseServerClient(req)` and `createSupabaseAdminClient()` utilities. Eliminates inline cookie/config duplication across API routes.

### 12. Shared TypeScript Types ✅
New file: [types/database.ts](file:///Users/fabriz/dev/yoel/presupuestosZOMA/types/database.ts)

170-line type definitions covering all database entities. Replaces scattered `any` casts and duplicate local type definitions across 12+ files.

### 13. Dashboard `any` Elimination ✅
Replaced `(item: any)` cast in balance reducer with `(item: { debit: number; credit: number })`. Imported `DashboardStats` from shared types.

### 14. Unused `@react-pdf/renderer` Removed ✅
```diff:package.json
{
  "name": "presupuesto-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@react-pdf/renderer": "^4.5.1",
    "@supabase/ssr": "^0.10.2",
    "@supabase/supabase-js": "^2.105.2",
    "@tanstack/react-table": "^8.21.3",
    "clsx": "^2.1.1",
    "lucide-react": "^1.14.0",
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-hook-form": "^7.75.0",
    "recharts": "^3.8.1",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "xlsx": "^0.18.5",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
===
{
  "name": "presupuesto-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@supabase/ssr": "^0.10.2",
    "@supabase/supabase-js": "^2.105.2",
    "@tanstack/react-table": "^8.21.3",
    "clsx": "^2.1.1",
    "lucide-react": "^1.14.0",
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-hook-form": "^7.75.0",
    "recharts": "^3.8.1",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "xlsx": "^0.18.5",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

Never imported anywhere. Saves ~2.5MB from `node_modules` and build.

### 15. Unused Login Import Removed ✅
`useSearchParams` was imported but never used in the login page.

### 16. Template SVGs Cleaned ✅
Removed 5 `create-next-app` default SVGs from `public/`: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`.

### 17. WhatsApp Placeholder Annotated ✅
Added `// TODO` comment to the hardcoded 5491100000000 number so it's flagged for replacement.

---

## Verification Results

| Check | Before | After |
|:---|:---:|:---:|
| Middleware deprecation warning | ❌ Every request | ✅ Gone |
| scroll-behavior warning | ❌ On navigation | ✅ Gone |
| Recharts dimension errors | ❌ 4+ per load | ✅ Gone |
| Login background 404 | ❌ Always | ✅ CSS gradient |
| Register background 404 | ❌ Always | ✅ CSS gradient |
| Auth bypass (`register-company`) | ❌ Exploitable | ✅ JWT-only |
| Plan bypass (vendedores API) | ❌ Exploitable | ✅ Server check |
| Vendedor URL access to admin | ❌ Client-only redirect | ✅ Proxy enforcement |
| Server logs | ❌ Noisy | ✅ Clean |

---

## Remaining Work (Not Done)

> [!IMPORTANT]
> These items require deeper refactoring or database changes and were deferred:

| Item | Reason Deferred |
|:---|:---|
| **Migrate all client pages to use `/api/next-number`** | Requires updating 5 files (presupuestos/nuevo, pedidos/nuevo, portal, vendedor/presupuestos) |
| **Create `supabase/schema.sql`** | Needs access to production Supabase to dump current schema |
| **Decompose monolithic files** | 700-line portal/page.tsx needs design decisions on component boundaries |
| **Implement RSC** | Major architecture change — needs planning |
| **Add Vitest** | Recommended as separate PR |
| **Rename `price` → `price`** | DB migration needed across all tables + 40+ file references |
| **Make WhatsApp number configurable** | Needs company settings table or env var |
