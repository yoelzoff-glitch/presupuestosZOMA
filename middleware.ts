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
  const esPaginaPublica = rutaActual.startsWith('/p/')

  // Rutas exclusivas de Admin: todo lo que no sea auth, api, portal, vendedor o superadmin
  const esRutaAdmin = !esPaginaAuth && !esPaginaApi && !esPaginaPortal && !esPaginaVendedor && !esPaginaSuperAdmin

  // Permitir API routes sin middleware (manejan su propia seguridad)
  if (esPaginaApi) return respuesta

  // 0. Protección de Super Admin (Solo Yoel)
  if (esPaginaSuperAdmin) {
    if (!usuario || usuario.email?.toLowerCase() !== 'yoel.zoff@gmail.com') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
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
    // Intentar obtener el rol de la metadata (mucho más rápido)
    let rol = usuario.app_metadata?.role

    // Si no está en metadata, fallback a la base de datos (solo una vez)
    if (!rol) {
      const { data: perfil } = await supabase
        .from('users_profiles')
        .select('role')
        .eq('id', usuario.id)
        .single()
      rol = perfil?.role
    }

    // Redirigir si intenta entrar a /auth estando logueado
    if (esPaginaAuth) {
      const url = request.nextUrl.clone()
      url.pathname = rol === 'customer' ? '/portal' : rol === 'vendedor' ? '/vendedor' : '/'
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

    // Admin/Vendedor no deben entrar al portal de clientes
    if (rol !== 'customer' && esPaginaPortal) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
