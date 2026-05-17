import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

/**
 * Middleware central de autenticación y autorización.
 * Protege las rutas según el rol del usuario (admin, vendedor, cliente).
 */
export async function middleware(request: NextRequest) {
  let respuesta = NextResponse.next({
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
          cookiesParaEstablecer: {
            name: string
            value: string
            options: CookieOptions
          }[]
        ) {
          cookiesParaEstablecer.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          respuesta = NextResponse.next({
            request,
          })

          cookiesParaEstablecer.forEach(({ name, value, options }) => {
            respuesta.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user: usuario },
  } = await supabase.auth.getUser()

  const rutaActual = request.nextUrl.pathname

  const esPaginaAuth = rutaActual.startsWith('/auth')
  const esPaginaApi = rutaActual.startsWith('/api')
  const esPaginaPortal = rutaActual.startsWith('/portal')
  const esPaginaVendedor = rutaActual.startsWith('/vendedor')
  const esPaginaSuperAdmin = rutaActual.startsWith('/superadmin')
  const esPaginaPublica = rutaActual.startsWith('/p/') || rutaActual === '/'

  // Rutas exclusivas de Admin: todo lo que no sea auth, api, portal, vendedor o superadmin
  const esRutaAdmin = !esPaginaAuth && !esPaginaApi && !esPaginaPortal && !esPaginaVendedor && !esPaginaSuperAdmin

  // Permitir API routes sin middleware (manejan su propia seguridad)
  if (esPaginaApi) return respuesta

  // 0. Protección de Super Admin (Solo Yoel)
  if (esPaginaSuperAdmin) {
    if (!usuario || usuario.email?.toLowerCase() !== 'yoel.zoff@gmail.com') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // 1. Redirigir a login si no hay usuario y no es página de auth ni pública
  if (!usuario && !esPaginaAuth && !esPaginaPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // 2. Si hay usuario, validar permisos según rol
  if (usuario) {
    // 1. Obtener perfil y datos de la empresa (suscripción)
    const { data: perfil } = await supabase
      .from('users_profiles')
      .select(`
        role,
        company_id,
        companies (
          subscription_expiry
        )
      `)
      .eq('id', usuario.id)
      .single()

    const rol = perfil?.role
    // @ts-ignore - companies es un objeto por la relación select
    const vencimientoEmpresa = perfil?.companies?.subscription_expiry

    // 2. Validar Suscripción Vencida de la Empresa (Excepto Yoel)
    const esYoel = usuario.email?.toLowerCase() === 'yoel.zoff@gmail.com'
    if (!esYoel && vencimientoEmpresa) {
      const hoy = new Date()
      const vencimiento = new Date(vencimientoEmpresa)
      
      if (hoy > vencimiento && rutaActual !== '/vencido' && !esPaginaPublica && !esPaginaAuth) {
        const url = request.nextUrl.clone()
        url.pathname = '/vencido'
        return NextResponse.redirect(url)
      }
    }

    // Redirigir si intenta entrar a /auth o / (landing) estando logueado
    if (esPaginaAuth || rutaActual === '/') {
      const url = request.nextUrl.clone()
      url.pathname = 
        rol === 'customer' ? '/portal' : 
        rol === 'vendedor' ? '/vendedor' : 
        rol === 'contador' ? '/contador' : 
        '/dashboard'
      return NextResponse.redirect(url)
    }

    // El Cliente (customer) solo puede entrar a /portal
    if (rol === 'customer' && !esPaginaPortal) {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      return NextResponse.redirect(url)
    }

    // El Vendedor solo puede entrar a /vendedor (no rutas de admin)
    if (rol === 'vendedor' && esRutaAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/vendedor'
      return NextResponse.redirect(url)
    }

    // El Contador solo puede entrar a /contador, /facturas, y /cuenta-corriente
    if (rol === 'contador') {
      const esPaginaContador = rutaActual.startsWith('/contador')
      const esPaginaFacturas = rutaActual.startsWith('/facturas')
      const esPaginaCuentaCorriente = rutaActual.startsWith('/cuenta-corriente')
      const esRutaPermitida = esPaginaContador || esPaginaFacturas || esPaginaCuentaCorriente || esPaginaAuth || esPaginaPublica

      if (!esRutaPermitida) {
        const url = request.nextUrl.clone()
        url.pathname = '/contador'
        return NextResponse.redirect(url)
      }
    }

    // Admin/Vendedor no deben entrar al portal de clientes
    if (rol !== 'customer' && esPaginaPortal) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
