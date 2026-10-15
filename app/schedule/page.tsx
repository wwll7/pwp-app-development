'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, LogIn, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type State = 'free' | 'busy' | 'unset'
type Profile = { id: string; display_name: string; avatar_url: string | null }
type Interval = { player_id: string; starts_at: string; ends_at: string; state: State }
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const COLORS: Record<State, string> = { free: 'bg-emerald-400/85', busy: 'bg-red-400/85', unset: 'bg-amber-300/85' }

export default function SchedulePage() {
  const [user, setUser] = useState<any>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [intervals, setIntervals] = useState<Interval[]>([])
  const [date, setDate] = useState(() => dayStart(new Date()))
  const [status, setStatus] = useState('Loading shared schedule…')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { void load(date) }, [date])
  async function load(selected: Date) {
    setRefreshing(true)
    const supabase = createClient()
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError || !auth.user) { setUser(null); setStatus('Sign in to view the shared schedule.'); setRefreshing(false); return }
    setUser(auth.user)
    const start = dayStart(selected); const end = new Date(start); end.setDate(end.getDate() + 1)
    const [{ data: players, error: playersError }, { data: availability, error: availabilityError }] = await Promise.all([
      supabase.from('player_profiles').select('id, display_name, avatar_url').order('display_name'),
      supabase.from('availability_intervals').select('player_id, starts_at, ends_at, state').lt('starts_at', end.toISOString()).gt('ends_at', start.toISOString()),
    ])
    if (playersError || availabilityError) setStatus('Could not load the shared schedule. Try refreshing.')
    else { setProfiles((players ?? []) as Profile[]); setIntervals((availability ?? []) as Interval[]); setStatus('') }
    setRefreshing(false)
  }
  async function signIn() { await createClient().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: `${window.location.origin}/auth/callback?returnTo=/schedule` } }) }
  const label = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const rows = useMemo(() => profiles.map((profile) => ({ profile, hours: HOURS.map((hour) => stateAt(profile.id, hour, date, intervals)), free: HOURS.filter((hour) => stateAt(profile.id, hour, date, intervals) === 'free').length })).sort((a, b) => b.free - a.free || a.profile.display_name.localeCompare(b.profile.display_name)), [profiles, intervals, date])

  if (!user) return <main className="min-h-screen bg-background text-foreground"><Header /><section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 text-center"><CalendarDays className="text-amber-400" /><h1 className="mt-5 text-3xl font-semibold">Shared schedule</h1><p className="mt-3 text-sm text-muted-foreground">Sign in with Discord to compare your squad&apos;s availability.</p><Button className="mt-7" onClick={signIn}><LogIn data-icon="inline-start" /> Sign in with Discord</Button></section></main>

  return <main className="min-h-screen bg-background text-foreground"><Header /><div className="mx-auto max-w-7xl px-4 py-7 sm:px-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-sm font-medium text-amber-400">Squad schedule</p><h1 className="text-3xl font-semibold">Who&apos;s free to play?</h1><p className="mt-2 text-sm text-muted-foreground">Local time: {timezone}. Unset means unknown, not free.</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><ChevronLeft /></Button><Button variant="outline" onClick={() => setDate(dayStart(new Date()))}>{label}</Button><Button variant="outline" size="icon" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}><ChevronRight /></Button><Button variant="ghost" size="icon" aria-label="Refresh schedule" disabled={refreshing} onClick={() => void load(date)}><RefreshCw /></Button></div></div>{status && <p className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{status}</p>}<div className="mt-7 flex flex-wrap gap-4 text-xs text-muted-foreground"><Legend state="free" /><Legend state="busy" /><Legend state="unset" /></div><div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card"><div className="overflow-x-auto"><div className="min-w-[920px]"><div className="grid grid-cols-[180px_repeat(24,minmax(31px,1fr))] border-b border-border bg-muted/30 text-[10px] text-muted-foreground"><div className="sticky left-0 z-10 bg-muted/95 px-4 py-3">Player</div>{HOURS.map((hour) => <div key={hour} className="border-l border-border/60 px-1 py-3 text-center">{hourLabel(hour)}</div>)}</div>{rows.length === 0 ? <div className="px-6 py-14 text-center text-sm text-muted-foreground">No player availability has been added yet.</div> : rows.map(({ profile, hours }) => <div key={profile.id} className="grid grid-cols-[180px_repeat(24,minmax(31px,1fr))] border-b border-border/60"><div className="sticky left-0 z-10 flex items-center gap-3 bg-card px-4 py-3 text-sm font-medium"><span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs">{profile.display_name.slice(0, 2).toUpperCase()}</span><span className="truncate">{profile.display_name}</span></div>{hours.map((state, hour) => <div key={hour} title={`${profile.display_name}: ${stateLabel(state)}`} className={`min-h-14 border-l border-border/60 ${COLORS[state]}`} />)}</div>)}</div></div></div></div></main>
}
function Header() { return <header className="flex items-center justify-between border-b border-border/70 px-4 py-4 sm:px-8"><a href="/" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-amber-300 font-black text-amber-950">P</span><span className="font-bold">PWP</span></a><nav className="flex items-center gap-4 text-sm"><a href="/schedule">Schedule</a><a className="text-muted-foreground hover:text-foreground" href="/availability">Availability</a><a className="text-muted-foreground hover:text-foreground" href="/find-lobby">Find a Lobby</a></nav></header> }
function Legend({ state }: { state: State }) { return <span className="flex items-center gap-2"><span className={`size-3 rounded-sm ${COLORS[state]}`} />{stateLabel(state)}</span> }
function stateAt(playerId: string, hour: number, day: Date, intervals: Interval[]): State { const start = new Date(day); start.setHours(hour, 0, 0, 0); const end = new Date(start); end.setHours(hour + 1); const matches = intervals.filter((item) => item.player_id === playerId && new Date(item.starts_at) < end && new Date(item.ends_at) > start); if (matches.some((item) => item.state === 'busy')) return 'busy'; if (matches.some((item) => item.state === 'free')) return 'free'; return 'unset' }
function dayStart(date: Date) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value }
function addDays(date: Date, amount: number) { const value = new Date(date); value.setDate(value.getDate() + amount); return value }
function hourLabel(hour: number) { return `${hour % 12 || 12}${hour >= 12 ? 'p' : 'a'}` }
function stateLabel(state: State) { return state[0].toUpperCase() + state.slice(1) }

