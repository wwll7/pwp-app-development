'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, Check, LogIn, MessageSquareText, ShieldCheck, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export default function Page() {
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [returnTo, setReturnTo] = useState('/availability')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setReturnTo(params.get('returnTo') || '/availability')
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user))
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user))
      setLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn() {
    setStatus('Opening Discord…')
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    })
    if (error) setStatus('Discord sign-in could not start. Please try again.')
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading PWP…</main>

  if (signedIn) return <AuthenticatedHome onSignOut={() => { void createClient().auth.signOut(); window.location.assign('/') }} />

  return <main className="min-h-screen bg-background text-foreground"><div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8"><header className="flex items-center justify-between"><Brand /><span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">Squad scheduling</span></header><section className="flex flex-1 items-center py-14"><div className="max-w-2xl"><p className="mb-5 flex items-center gap-2 text-sm font-medium text-amber-400"><span className="size-2 rounded-full bg-amber-400" /> Plan. Play. Win.</p><h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Find the time your squad can actually play.</h1><p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">PWP brings player availability into one clear view, so your Valorant sessions start with a plan instead of a pile of messages.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"><Button size="lg" onClick={signIn} disabled={status.startsWith('Opening')}><LogIn data-icon="inline-start" /> {status.startsWith('Opening') ? 'Opening Discord…' : 'Sign in with Discord'}</Button><p className="text-xs text-muted-foreground">Sign in is required to access shared schedules.</p></div>{status && !status.startsWith('Opening') && <p role="alert" className="mt-4 text-sm text-red-400">{status}</p>}<div className="mt-14 grid max-w-xl gap-3 sm:grid-cols-3"><Feature icon={CalendarDays} label="Share availability" /><Feature icon={Users} label="Spot good windows" /><Feature icon={MessageSquareText} label="Coordinate in Discord" /></div></div></section><footer className="flex items-center gap-2 border-t border-border/70 pt-5 text-xs text-muted-foreground"><ShieldCheck /> Your schedule stays behind Discord authentication.</footer></div></main>
}

function AuthenticatedHome({ onSignOut }: { onSignOut: () => void }) { return <main className="min-h-screen bg-background text-foreground"><header className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-8"><Brand /><div className="flex items-center gap-4"><a className="text-sm text-foreground" href="/schedule">Schedule</a><a className="text-sm text-muted-foreground hover:text-foreground" href="/availability">Availability</a><Button variant="outline" size="sm" onClick={onSignOut}>Sign out</Button></div></header><section className="mx-auto max-w-5xl px-5 py-12 sm:px-8"><p className="text-sm font-medium text-amber-400">PWP workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Coordinate your next session.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Start by keeping your availability current. Lobby planning and Discord event tools will build on this shared schedule.</p><a href="/availability"><Button className="mt-7">Open availability <ArrowRight data-icon="inline-end" /></Button></a><div className="mt-12 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground"><Check className="mb-3 text-emerald-400" />You are signed in. Shared scheduling features are available.</div></section></main> }

function Brand() { return <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-amber-300 font-black text-amber-950">P</span><span className="font-bold tracking-tight">PWP</span></div> }
function Feature({ icon: Icon, label }: { icon: typeof CalendarDays; label: string }) { return <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-3 text-xs text-muted-foreground"><Icon className="text-amber-400" />{label}</div> }
