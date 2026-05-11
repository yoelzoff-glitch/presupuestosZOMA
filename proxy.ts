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
