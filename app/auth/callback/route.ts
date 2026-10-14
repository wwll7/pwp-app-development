import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const authError = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(new URL(`/availability?auth_error=${encodeURIComponent(error.message)}`, url.origin))
    }
  }
  if (authError) {
    return NextResponse.redirect(new URL(`/availability?auth_error=${encodeURIComponent(authError)}`, url.origin))
  }
  return NextResponse.redirect(new URL('/', url.origin))
}
