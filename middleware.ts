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
  const rutasPublicas = ['/sobre-nosotros', '/terminos', '/privacidad', '/contacto']
  const esPaginaPublica =
    rutaActual.startsWith('/p/') ||
    rutaActual === '/' ||
    rutasPublicas.some(path => rutaActual === path || rutaActual.startsWith(path + '/'))

  // Rutas exclusivas de Admin: todo lo que no sea auth, api, portal, vendedor, superadmin o pública
  const esRutaAdmin = !esPaginaAuth && !esPaginaApi && !esPaginaPortal && !esPaginaVendedor && !esPaginaSuperAdmin && !esPaginaPublica

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
    let rol = usuario.app_metadata?.role
    let vencimientoEmpresa = request.cookies.get('sb-company-expiry')?.value

    // Cache miss: Si falta el rol o la expiración de la empresa, consultamos la DB (ocurre 1 sola vez por sesión)
    if (!rol || !vencimientoEmpresa) {
      console.log('🔍 [Middleware] Cache miss. Consultando datos de perfil y empresa en Supabase...');
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

      if (perfil) {
        rol = perfil.role
        // @ts-ignore
        const rawExpiry = perfil.companies?.subscription_expiry
        vencimientoEmpresa = rawExpiry ? String(rawExpiry) : 'none'

        // Guardamos en un cookie seguro por 2 horas para evitar lecturas constantes de DB
        respuesta.cookies.set('sb-company-expiry', vencimientoEmpresa, {
          maxAge: 60 * 60 * 2, // Cache de 2 horas
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
        })
      }
    }

    const vencimiento = vencimientoEmpresa

    // Función auxiliar para retornar redirecciones copiando cookies para conservar el caché
    const redireccionar = (destino: string) => {
      const url = request.nextUrl.clone()
      url.pathname = destino
      const redirectResp = NextResponse.redirect(url)
      
      // Conservar las cookies generadas en la redirección
      respuesta.cookies.getAll().forEach(cookie => {
        redirectResp.cookies.set(cookie.name, cookie.value, {
          maxAge: cookie.maxAge,
          path: cookie.path,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite,
        })
      })
      return redirectResp
    }

    // 2. Validar Suscripción Vencida de la Empresa (Excepto Yoel)
    const esYoel = usuario.email?.toLowerCase() === 'yoel.zoff@gmail.com'
    if (!esYoel && vencimiento && vencimiento !== 'none') {
      const hoy = new Date()
      const limite = new Date(vencimiento)
      
      if (hoy > limite && rutaActual !== '/vencido' && !esPaginaPublica && !esPaginaAuth) {
        return redireccionar('/vencido')
      }
    }

    // Redirigir si intenta entrar a /auth o / (landing) estando logueado
    if (esPaginaAuth || rutaActual === '/') {
      const dashboardDestino = 
        rol === 'customer' ? '/portal' : 
        rol === 'vendedor' ? '/vendedor' : 
        rol === 'contador' ? '/contador' : 
        '/dashboard'
      return redireccionar(dashboardDestino)
    }

    // El Cliente (customer) solo puede entrar a /portal o páginas públicas
    if (rol === 'customer' && !esPaginaPortal && !esPaginaPublica) {
      return redireccionar('/portal')
    }

    // El Vendedor solo puede entrar a /vendedor (no rutas de admin)
    if (rol === 'vendedor' && esRutaAdmin) {
      return redireccionar('/vendedor')
    }

    // El Contador solo puede entrar a /contador, /facturas, y /cuenta-corriente
    if (rol === 'contador') {
      const esPaginaContador = rutaActual.startsWith('/contador')
      const esPaginaFacturas = rutaActual.startsWith('/facturas')
      const esPaginaCuentaCorriente = rutaActual.startsWith('/cuenta-corriente')
      const esRutaPermitida = esPaginaContador || esPaginaFacturas || esPaginaCuentaCorriente || esPaginaAuth || esPaginaPublica

      if (!esRutaPermitida) {
        return redireccionar('/contador')
      }
    }

    // Admin/Vendedor no deben entrar al portal de clientes
    if (rol !== 'customer' && esPaginaPortal) {
      return redireccionar('/dashboard')
    }
  }

  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
