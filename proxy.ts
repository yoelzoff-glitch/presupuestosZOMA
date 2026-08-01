import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CompanyAccess = {
  billing_status: string | null
  trial_ends_at: string | null
  billing_grace_ends_at: string | null
  subscription_expiry: string | null
  mp_preapproval_id: string | null
  onboarding_completed_at: string | null
}

function billingAllowed(company: CompanyAccess, now = Date.now()) {
  if (!company.billing_status) {
    return !company.subscription_expiry || new Date(company.subscription_expiry).getTime() >= now
  }
  if (company.billing_status === 'active') return true
  if (company.billing_status === 'trial') {
    const end = company.trial_ends_at || company.subscription_expiry
    return Boolean(end && new Date(end).getTime() >= now)
  }
  if (company.billing_status === 'past_due' && company.billing_grace_ends_at) {
    return new Date(company.billing_grace_ends_at).getTime() >= now
  }
  return false
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies: Array<{ name: string; value: string; options: CookieOptions }>) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname
  const isApi = pathname.startsWith('/api')
  if (isApi) return response

  const isAuth = pathname.startsWith('/auth')
  const isRegister = pathname === '/register' || pathname.startsWith('/register/')
  const isPortal = pathname.startsWith('/portal')
  const isSeller = pathname.startsWith('/vendedor')
  const isSuperAdmin = pathname.startsWith('/superadmin')
  const publicRoutes = ['/sobre-nosotros', '/terminos', '/privacidad', '/contacto']
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/p/') ||
    publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  const {
    data: { user },
  } = await supabase.auth.getUser()

  function redirectTo(destination: string) {
    const url = request.nextUrl.clone()
    url.pathname = destination
    url.search = ''
    const redirectResponse = NextResponse.redirect(url)
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
    return redirectResponse
  }

  if (!user) {
    if (isPublic || isAuth || isRegister) return response
    return redirectTo('/auth/login')
  }

  if (isSuperAdmin && user.email?.toLowerCase() !== 'yoel.zoff@gmail.com') {
    return redirectTo('/dashboard')
  }

  const { data: profile } = await supabase
    .from('users_profiles')
    .select(`
      role,
      company_id,
      company:companies (
        billing_status,
        trial_ends_at,
        billing_grace_ends_at,
        subscription_expiry,
        mp_preapproval_id,
        onboarding_completed_at
      )
    `)
    .eq('id', user.id)
    .maybeSingle()

  const companyValue = Array.isArray(profile?.company) ? profile.company[0] : profile?.company
  const company = companyValue as CompanyAccess | null | undefined

  if (!profile?.company_id || !company) {
    if (isRegister || pathname === '/auth/update-password') return response
    return redirectTo('/register/return')
  }

  const role = profile.role || user.app_metadata?.role || 'admin'
  const isOwner = user.email?.toLowerCase() === 'yoel.zoff@gmail.com'
  const allowedWhileBlocked =
    pathname === '/vencido' ||
    pathname.startsWith('/configuracion/suscripcion') ||
    isAuth ||
    isPublic

  if (!isOwner && !billingAllowed(company) && !allowedWhileBlocked) {
    return redirectTo('/vencido')
  }

  const needsOnboarding = Boolean(
    company.mp_preapproval_id && !company.onboarding_completed_at
  )
  if (
    needsOnboarding &&
    pathname !== '/onboarding' &&
    !allowedWhileBlocked &&
    !isRegister
  ) {
    return redirectTo('/onboarding')
  }

  if (isAuth || isRegister || pathname === '/') {
    if (needsOnboarding) return redirectTo('/onboarding')
    const destination =
      role === 'customer' ? '/portal' :
      role === 'vendedor' ? '/vendedor' :
      role === 'contador' ? '/contador' :
      '/dashboard'
    return redirectTo(destination)
  }

  const isAdminRoute =
    !isPortal && !isSeller && !isSuperAdmin && !isPublic && !isAuth && !isRegister

  if (role === 'customer' && !isPortal && !isPublic) return redirectTo('/portal')
  if (role === 'vendedor' && isAdminRoute) return redirectTo('/vendedor')

  if (role === 'contador') {
    const allowedAccountantRoute =
      pathname.startsWith('/contador') ||
      pathname.startsWith('/facturas') ||
      pathname.startsWith('/cuenta-corriente') ||
      isPublic
    if (!allowedAccountantRoute) return redirectTo('/contador')
  }

  if (role !== 'customer' && isPortal) return redirectTo('/dashboard')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
