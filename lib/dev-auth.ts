import { createClient } from '@/lib/supabase/client'

export async function startDevelopmentSession() {
  if (process.env.NODE_ENV === 'production') return false
  const response = await fetch('/api/dev-session', { method: 'POST' })
  if (!response.ok) return false
  const payload = await response.json() as { session?: { access_token: string; refresh_token: string } }
  if (!payload.session) return false
  const { error } = await createClient().auth.setSession(payload.session)
  return !error
}
