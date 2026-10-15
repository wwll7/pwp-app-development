import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items) => { items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } } })
  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const protectedRoute = pathname === '/availability' || pathname.startsWith('/availability/')

  if (protectedRoute && !user) {
    const destination = `${pathname}${request.nextUrl.search}`
    const signInUrl = request.nextUrl.clone()
    signInUrl.pathname = '/'
    signInUrl.search = `?returnTo=${encodeURIComponent(destination)}`
    return NextResponse.redirect(signInUrl)
  }

  return response
}
