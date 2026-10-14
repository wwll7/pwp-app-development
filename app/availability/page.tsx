'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, FileUp, LogIn, Save, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { ICS_LIMITS, overlaps, parseCalendar, type ParsedCalendarEvent } from '@/lib/ics'

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
  const [importEvents, setImportEvents] = useState<ParsedCalendarEvent[]>([])
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [importName, setImportName] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)

  useEffect(() => { void load() }, [])
  useEffect(() => { const stop = () => setPainting(false); window.addEventListener('pointerup', stop); return () => window.removeEventListener('pointerup', stop) }, [])

  async function load() {
    const callbackError = new URLSearchParams(window.location.search).get('auth_error')
    if (callbackError) setStatus(`Discord sign-in failed: ${callbackError}`)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    if (!user) { setStatus('Sign in to edit your availability.'); return }
    const metadata = user.user_metadata ?? {}
    const discordId = metadata.provider_id ?? metadata.sub ?? metadata.user_name ?? user.id
    const displayName = metadata.full_name ?? metadata.name ?? metadata.user_name ?? user.email?.split('@')[0] ?? 'Player'
    const { data: existing } = await supabase.from('player_profiles').upsert({ id: user.id, discord_user_id: String(discordId), display_name: displayName, avatar_url: metadata.avatar_url ?? null }, { onConflict: 'id' }).select().single()
    setProfile(existing)
    const { data, error } = await supabase.from('availability_intervals').select('starts_at, state').eq('player_id', user.id).gte('starts_at', new Date().toISOString()).order('starts_at')
    if (error) { setStatus('Could not load availability.'); return }
    const next: Record<string, State> = {}
    data?.forEach((row) => { next[key(new Date(row.starts_at))] = row.state })
    setSaved(next); setDraft(next); setStatus('')
  }

  function paint(date: Date) { setDraft((current) => ({ ...current, [key(date)]: mode })); setPainting(true) }
  async function save() {
    if (!user) return
    setSaving(true); setStatus('Saving changes…')
    const start = new Date(); start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 7 * 86400000)
    const supabase = createClient()
    const { error: removeError } = await supabase.from('availability_intervals').delete().eq('player_id', user.id).eq('source', 'manual').gte('starts_at', start.toISOString()).lt('starts_at', end.toISOString())
    if (!removeError) {
      const rows = Object.entries(draft).filter(([k]) => { const date = fromKey(k); return date >= start && date < end && draft[k] !== 'unset' }).map(([k, state]) => { const date = fromKey(k); return { player_id: user.id, starts_at: date.toISOString(), ends_at: new Date(date.getTime() + 3600000).toISOString(), state, source: 'manual' } })
      const { error } = rows.length ? await supabase.from('availability_intervals').insert(rows) : { error: null }
      if (!error) { setSaved(draft); setStatus('Saved. Your squad can now find you in these windows.'); setSaving(false); return }
    }
    setStatus('Save failed. Check your connection and try again.'); setSaving(false)
  }
  async function signIn() {
    setStatus('Opening Discord…')
    const { error } = await createClient().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback` } })
    if (error) setStatus(`Could not start Discord sign-in: ${error.message}`)
  }
  async function signOut() { await createClient().auth.signOut(); setUser(null); setProfile(null); setStatus('Signed out.') }

  async function readImport(file: File) {
    setImportError(''); setImportName(file.name)
    if (!file.name.toLowerCase().endsWith('.ics')) { setImportError('Choose an .ics calendar file.'); return }
    if (file.size > ICS_LIMITS.maxBytes) { setImportError('This file is larger than the 2 MB import limit.'); return }
    try {
      const events = parseCalendar(await file.text())
      if (!events.length) throw new Error('No upcoming events were found in this calendar.')
      setImportEvents(events); setExcluded(new Set())
    } catch (error) { setImportEvents([]); setImportError(error instanceof Error ? error.message : 'Could not parse this calendar.') }
  }
  async function applyImport() {
    if (!user || !importEvents.length) return
    setImporting(true); setImportError('')
    const selected = importEvents.filter((event) => !excluded.has(event.sourceKey))
    const supabase = createClient()
    const { data: prior } = await supabase.from('availability_intervals').select('starts_at, ends_at, source_key, is_manual_override').eq('player_id', user.id).eq('source', 'ics')
    const existingKeys = new Set((prior ?? []).map((row) => row.source_key).filter(Boolean))
    const affected = selected.filter((event) => !existingKeys.has(event.sourceKey))
    const rows = affected.map((event) => ({ player_id: user.id, starts_at: event.startsAt, ends_at: event.endsAt, state: 'busy', source: 'ics', source_key: event.sourceKey, is_manual_override: false }))
    const { error } = rows.length ? await supabase.from('availability_intervals').insert(rows) : { error: null }
    if (error) setImportError('Import could not be applied. Your existing availability was not changed.')
    else { setStatus(`Imported ${affected.length} Busy interval${affected.length === 1 ? '' : 's'}. Manual corrections were preserved.`); setImportEvents([]); setImportName(''); void load() }
    setImporting(false)
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const week = days.map((offset) => { const date = new Date(weekStart); date.setDate(date.getDate() + offset); return date })
  const selectedCount = importEvents.length - excluded.size
  const conflicts = useMemo(() => importEvents.filter((event) => Object.entries(draft).some(([k, state]) => state === 'free' && overlaps(event.startsAt, event.endsAt, fromKey(k).toISOString(), new Date(fromKey(k).getTime() + 3600000).toISOString()))).length, [importEvents, draft])

  return <main className="min-h-screen bg-background text-foreground"><header className="flex items-center justify-between border-b border-border/70 px-4 py-4 sm:px-8"><a href="/" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-amber-300 font-black text-amber-950">P</span><span className="font-bold">PWP</span></a><div className="flex items-center gap-3">{user ? <><span className="hidden text-sm text-muted-foreground sm:inline">{profile?.display_name ?? 'Signed in'}</span><Button variant="outline" size="sm" onClick={signOut}>Sign out</Button></> : <Button size="sm" onClick={signIn}><LogIn data-icon="inline-start" /> Sign in with Discord</Button>}</div></header><div className="mx-auto max-w-6xl px-4 py-8 sm:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-medium text-amber-400">Your schedule</p><h1 className="text-3xl font-semibold tracking-tight">Availability</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Paint the hours you can play. Unset stays unknown and is never treated as free.</p></div>{user && <div className="flex items-center gap-2"><Button variant="outline" disabled={!dirty || saving} onClick={() => setDraft(saved)}><Trash2 data-icon="inline-start" /> Discard</Button><Button disabled={!dirty || saving} onClick={save}><Save data-icon="inline-start" /> {saving ? 'Saving…' : 'Save changes'}</Button></div>}</div>{status && <p className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{status}</p>}{!user ? <section className="mt-8 rounded-2xl border border-border bg-card p-8 text-center"><CalendarDays className="mx-auto text-amber-400" /><h2 className="mt-4 text-xl font-semibold">Sign in to manage your schedule</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Use Discord so your squad can recognize you. Your availability remains editable before you save.</p><Button className="mt-6" onClick={signIn}>Continue with Discord</Button></section> : <><section className="mt-8 rounded-2xl border border-border bg-card p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Import calendar</h2><p className="mt-1 text-sm text-muted-foreground">Preview upcoming Busy events before they touch your schedule.</p></div><label className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><FileUp data-icon="inline-start" /> Choose .ics file<input type="file" accept=".ics,text/calendar" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImport(file) }} /></label></div>{importError && <p className="mt-4 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">{importError}</p>}{importEvents.length > 0 && <div className="mt-5 border-t border-border pt-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">Preview: {importName}</p><p className="text-sm text-muted-foreground">{selectedCount} of {importEvents.length} events selected{conflicts ? ` · ${conflicts} overlap existing Free hours` : ''}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setImportEvents([]); setImportName('') }}><X data-icon="inline-start" /> Cancel</Button><Button size="sm" disabled={importing} onClick={() => void applyImport()}>{importing ? 'Applying…' : 'Confirm import'}</Button></div></div><div className="mt-4 max-h-80 overflow-auto rounded-xl border border-border">{importEvents.map((event) => <label key={event.sourceKey} className="flex gap-3 border-b border-border p-3 last:border-0"><input type="checkbox" checked={!excluded.has(event.sourceKey)} onChange={() => setExcluded((current) => { const next = new Set(current); next.has(event.sourceKey) ? next.delete(event.sourceKey) : next.add(event.sourceKey); return next })} /><span className="min-w-0 text-sm"><span className="block truncate font-medium">{event.title}</span><span className="block text-muted-foreground">{event.localStart} → {event.localEnd}{event.recurring ? ' · recurring' : ''}</span><span className="block text-xs text-red-300">Busy interval</span></span></label>)}</div></div>}</section><section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6"><div className="flex items-center justify-between gap-2"><Button variant="outline" size="icon" aria-label="Previous week" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))}><ChevronLeft /></Button><div className="text-center"><h2 className="font-semibold">{weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(weekStart.getTime() + 6 * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</h2><p className="text-xs text-muted-foreground">Drag across hours to paint availability</p></div><Button variant="outline" size="icon" aria-label="Next week" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))}><ChevronRight /></Button></div><div className="mt-5 flex flex-wrap justify-center gap-2">{modes.map((item) => <Button key={item.value} variant={mode === item.value ? 'default' : 'outline'} size="sm" onClick={() => setMode(item.value)}><span className={`size-2 rounded-full ${item.tone}`} />{item.label}</Button>)}</div><div className="mt-5 overflow-x-auto"><div className="min-w-[680px]"><div className="grid grid-cols-[42px_repeat(7,minmax(0,1fr))] gap-1"> <div />{week.map((date) => <div key={date.toISOString()} className="pb-2 text-center text-xs font-medium text-muted-foreground">{date.toLocaleDateString(undefined, { weekday: 'short' })}<span className="block text-foreground">{date.getDate()}</span></div>)}{hours.map((hour) => <div key={hour} className="contents"><div className="pr-1 text-right text-[10px] text-muted-foreground">{String(hour).padStart(2, '0')}:00</div>{week.map((date) => { const cell = new Date(date); cell.setHours(hour); const state = draft[key(cell)] ?? 'unset'; return <button type="button" key={cell.toISOString()} aria-label={`${cell.toLocaleString()} ${state}`} className={`h-7 rounded-md border border-border/60 transition-colors ${state === 'free' ? 'bg-emerald-400/80' : state === 'busy' ? 'bg-red-400/80' : 'bg-amber-300/20 hover:bg-amber-300/40'}`} onPointerDown={(event) => { event.preventDefault(); paint(cell) }} onPointerEnter={() => { if (painting) paint(cell) }} />})}</div>)}</div></div></div></section></>
}</div></main>
}

function key(date: Date) { return date.toISOString().slice(0, 13) }
function fromKey(value: string) { return new Date(`${value}:00:00.000Z`) }
function startOfWeek(date: Date) { const next = new Date(date); next.setHours(0, 0, 0, 0); next.setDate(next.getDate() - next.getDay()); return next }
