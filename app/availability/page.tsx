'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, LogIn, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type State = 'free' | 'busy' | 'unset'
const modes: { value: State; label: string; tone: string }[] = [
  { value: 'free', label: 'Free', tone: 'bg-emerald-400' },
  { value: 'busy', label: 'Busy', tone: 'bg-red-400' },
  { value: 'unset', label: 'Erase', tone: 'bg-amber-300' },
]
const hours = Array.from({ length: 24 }, (_, i) => i)
const days = Array.from({ length: 7 }, (_, i) => i)

export default function AvailabilityPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [draft, setDraft] = useState<Record<string, State>>({})
  const [saved, setSaved] = useState<Record<string, State>>({})
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()))
  const [mode, setMode] = useState<State>('free')
  const [painting, setPainting] = useState(false)
  const [status, setStatus] = useState('Loading your availability…')
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load() }, [])
  useEffect(() => { const stop = () => setPainting(false); window.addEventListener('pointerup', stop); return () => window.removeEventListener('pointerup', stop) }, [])

  async function load() {
    const { data: { user } } = await createClient().auth.getUser()
    setUser(user)
    if (!user) { setStatus('Sign in to edit your availability.'); return }
    const metadata = user.user_metadata ?? {}
    const discordId = metadata.provider_id ?? metadata.sub ?? metadata.user_name ?? user.id
    const displayName = metadata.full_name ?? metadata.name ?? metadata.user_name ?? user.email?.split('@')[0] ?? 'Player'
    const { data: existing } = await createClient().from('player_profiles').upsert({ id: user.id, discord_user_id: String(discordId), display_name: displayName, avatar_url: metadata.avatar_url ?? null }, { onConflict: 'id' }).select().single()
    setProfile(existing)
    const { data, error } = await createClient().from('availability_intervals').select('starts_at, ends_at, state').eq('player_id', user.id).gte('starts_at', new Date().toISOString()).order('starts_at')
    if (error) { setStatus('Could not load availability.'); return }
    const next: Record<string, State> = {}
    data?.forEach((row) => { const date = new Date(row.starts_at); next[key(date)] = row.state })
    setSaved(next); setDraft(next); setStatus('')
  }

  function paint(date: Date) { const k = key(date); setDraft((current) => ({ ...current, [k]: mode })); setPainting(true) }
  async function save() {
    if (!user) return
    setSaving(true); setStatus('Saving changes…')
    const start = new Date(); start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    const { error: removeError } = await createClient().from('availability_intervals').delete().eq('player_id', user.id).gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString())
    if (!removeError) {
      const rows = Object.entries(draft).filter(([k]) => { const date = fromKey(k); return date >= start && date < end }).map(([k, state]) => { const date = fromKey(k); return { player_id: user.id, starts_at: date.toISOString(), ends_at: new Date(date.getTime() + 3600000).toISOString(), state, source: 'manual' } })
      const { error } = await createClient().from('availability_intervals').insert(rows)
      if (!error) { setSaved(draft); setStatus('Saved. Your squad can now find you in these windows.'); setSaving(false); return }
    }
    setStatus('Save failed. Check your connection and try again.'); setSaving(false)
  }
  async function signIn() { await createClient().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: `${window.location.origin}/auth/callback` } }) }
  async function signOut() { await createClient().auth.signOut(); setUser(null); setStatus('Signed out.') }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const week = days.map((offset) => { const date = new Date(weekStart); date.setDate(date.getDate() + offset); return date })
  return <main className="min-h-screen bg-background text-foreground"><header className="flex items-center justify-between border-b border-border/70 px-4 py-4 sm:px-8"><a href="/" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-amber-300 font-black text-amber-950">P</span><span className="font-bold">PWP</span></a><div className="flex items-center gap-3">{user ? <><span className="hidden text-sm text-muted-foreground sm:inline">{profile?.display_name ?? 'Signed in'}</span><Button variant="outline" size="sm" onClick={signOut}>Sign out</Button></> : <Button size="sm" onClick={signIn}><LogIn data-icon="inline-start" /> Sign in with Discord</Button>}</div></header><div className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-medium text-amber-400">Your schedule</p><h1 className="text-3xl font-semibold tracking-tight">Availability</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Paint the hours you can play. Unset stays unknown and is never treated as free.</p></div>{user && <div className="flex items-center gap-2"><Button variant="outline" disabled={!dirty || saving} onClick={() => setDraft(saved)}><Trash2 data-icon="inline-start" /> Discard</Button><Button disabled={!dirty || saving} onClick={save}><Save data-icon="inline-start" /> {saving ? 'Saving…' : 'Save changes'}</Button></div>}</div>{!user ? <section className="mt-8 rounded-2xl border border-border bg-card p-8 text-center"><CalendarDays className="mx-auto text-amber-400" /><h2 className="mt-4 text-xl font-semibold">Sign in to manage your schedule</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Use Discord so your squad can recognize you. Your availability remains editable before you save.</p><Button className="mt-6" onClick={signIn}>Continue with Discord</Button></section> : <><div className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3"><span className="mr-2 text-sm font-medium">Paint as</span>{modes.map((item) => <button key={item.value} onClick={() => setMode(item.value)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${mode === item.value ? 'bg-amber-300/20 text-amber-300 ring-1 ring-amber-300/50' : 'text-muted-foreground hover:bg-muted'}`}><span className={`size-2.5 rounded-full ${item.tone}`} />{item.label}</button>)}<span className="ml-auto text-xs text-muted-foreground">Timezone: {profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}</span></div><div className="mt-4 flex items-center justify-between"><Button variant="ghost" size="sm" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))}><ChevronLeft data-icon="inline-start" /> Previous</Button><p className="text-sm font-semibold">{week[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {week[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p><Button variant="ghost" size="sm" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))}>Next <ChevronRight data-icon="inline-end" /></Button></div><div className="mt-2 overflow-x-auto rounded-2xl border border-border bg-card"><div className="min-w-[720px]"><div className="grid grid-cols-[56px_repeat(7,minmax(88px,1fr))] border-b border-border"> <div />{week.map((date) => <div key={date.toISOString()} className="border-l border-border px-2 py-3 text-center"><p className="text-[11px] uppercase text-muted-foreground">{date.toLocaleDateString(undefined, { weekday: 'short' })}</p><p className="mt-1 text-sm font-semibold">{date.getDate()}</p></div>)}</div>{hours.map((hour) => <div key={hour} className="grid grid-cols-[56px_repeat(7,minmax(88px,1fr))]"><div className="border-b border-border px-2 py-2 text-right text-[10px] text-muted-foreground">{String(hour).padStart(2, '0')}:00</div>{week.map((date) => { const cell = new Date(date); cell.setHours(hour, 0, 0, 0); const state = draft[key(cell)] ?? 'unset'; return <button aria-label={`${cell.toLocaleDateString()} ${hour}:00 ${state}`} key={cell.toISOString()} onPointerDown={() => paint(cell)} onPointerEnter={() => painting && paint(cell)} className={`min-h-10 border-b border-l border-border transition-colors ${state === 'free' ? 'bg-emerald-400/70 hover:bg-emerald-400' : state === 'busy' ? 'bg-red-400/70 hover:bg-red-400' : 'bg-amber-300/15 hover:bg-amber-300/30'}`} />})}</div>)}</div></div></>}{status && <p role="status" className="mt-4 text-sm text-muted-foreground">{status}</p>}<div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><span className="flex size-5 items-center justify-center rounded-full bg-emerald-400/20"><Check className="size-3 text-emerald-400" /></span> Changes stay local until you choose Save changes.</div></div></main>
}

function key(date: Date) { return date.toISOString().slice(0, 13) }
function fromKey(value: string) { return new Date(`${value}:00:00.000Z`) }
function startOfWeek(date: Date) { const next = new Date(date); next.setHours(0, 0, 0, 0); next.setDate(next.getDate() - next.getDay()); return next }
