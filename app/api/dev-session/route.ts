import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TEST_EMAIL = 'pwp-dev@pwp.local'
const TEST_PASSWORD = 'PwpDevelopmentOnly-2026'
const TEST_USER_ID = '00000000-0000-4000-8000-000000000001'

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' || new URL(request.url).hostname !== 'localhost') {
    return NextResponse.json({ error: 'Development test mode is disabled.' }, { status: 404 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Supabase service key is not configured.' }, { status: 503 })

  const admin = createClient(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (listError) return NextResponse.json({ error: 'Could not inspect the development user.' }, { status: 500 })

  let user = users.users.find((candidate) => candidate.id === TEST_USER_ID || candidate.email === TEST_EMAIL)
  if (!user) {
    const created = await admin.auth.admin.createUser({ id: TEST_USER_ID, email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true, user_metadata: { provider_id: 'pwp-dev', full_name: 'Dev Player' } })
    if (created.error || !created.data.user) return NextResponse.json({ error: 'Could not create the development user.' }, { status: 500 })
    user = created.data.user
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, { password: TEST_PASSWORD, email_confirm: true, user_metadata: { provider_id: 'pwp-dev', full_name: 'Dev Player' } })
    if (updated.error) return NextResponse.json({ error: 'Could not reset the development user.' }, { status: 500 })
    user = updated.data.user
  }

  const profile = { id: user.id, discord_user_id: 'pwp-dev', display_name: 'Dev Player', avatar_url: null, timezone: 'UTC', default_interest: 4 }
  const { error: profileError } = await admin.from('player_profiles').upsert(profile, { onConflict: 'id' })
  if (profileError) return NextResponse.json({ error: 'Could not seed the development profile.' }, { status: 500 })

  const otherId = '00000000-0000-4000-8000-000000000002'
  const second = await admin.auth.admin.getUserById(otherId)
  if (second.error) await admin.auth.admin.createUser({ id: otherId, email: 'pwp-teammate@pwp.local', password: TEST_PASSWORD, email_confirm: true, user_metadata: { full_name: 'Nova' } })
  await admin.from('player_profiles').upsert({ id: otherId, discord_user_id: 'pwp-nova', display_name: 'Nova', avatar_url: null, timezone: 'UTC', default_interest: 3 }, { onConflict: 'id' })

  const now = new Date()
  now.setMinutes(0, 0, 0)
  const at = (hours: number) => new Date(now.getTime() + hours * 3600000).toISOString()
  await admin.from('availability_intervals').delete().in('player_id', [user.id, otherId]).eq('source', 'manual')
  await admin.from('availability_intervals').insert([
    { player_id: user.id, starts_at: at(1), ends_at: at(4), state: 'free', source: 'manual' },
    { player_id: user.id, starts_at: at(4), ends_at: at(5), state: 'busy', source: 'manual' },
    { player_id: otherId, starts_at: at(1), ends_at: at(2), state: 'free', source: 'manual' },
    { player_id: otherId, starts_at: at(2), ends_at: at(3), state: 'busy', source: 'manual' },
  ])

  const publicClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: session, error: signInError } = await publicClient.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD })
  if (signInError || !session.session) return NextResponse.json({ error: 'Could not create a development session.' }, { status: 500 })
  return NextResponse.json({ session: session.session })
}
