'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Clipboard, LogIn, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { startDevelopmentSession } from '@/lib/dev-auth'
import { copyableMessage, defaultSessionDuration, formatDuration, formatScore, fromLocalInput, localInputValue, rankCandidates, stateLabel, stateTone, type LobbyInterval, type LobbyProfile } from '@/lib/lobby-scoring'

type Window = { start: Date; end: Date; free: number; potential: number }

export default function FindLobbyPage() {
  const [user, setUser] = useState<any>(null)
  const [profiles, setProfiles] = useState<LobbyProfile[]>([])
  const [intervals, setIntervals] = useState<LobbyInterval[]>([])
  const [start, setStart] = useState(() => nextHour(new Date()))
  const [hours, setHours] = useState(3)
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState('Loading player availability…')
  const [copied, setCopied] = useState(false)

  useEffect(() => { void load() }, [])
  async function load() {
const supabase = createClient(); let { data: auth } = await supabase.auth.getUser()
  if (!auth.user) {
    await new Promise((resolve) => window.setTimeout(resolve, 150))
    auth = (await supabase.auth.getUser()).data
  }
  if (!auth.user) { setStatus('Sign in to find a lobby.'); return }
  setUser(auth.user)
    const [{ data: players, error: playerError }, { data: availability, error: intervalError }] = await Promise.all([
      supabase.from('player_profiles').select('id, display_name, discord_user_id, default_interest').order('display_name'),
      supabase.from('availability_intervals').select('player_id, starts_at, ends_at, state'),
    ])
    if (playerError || intervalError) setStatus('Could not load player availability. Try refreshing.')
    else { setProfiles((players ?? []) as LobbyProfile[]); setIntervals((availability ?? []) as LobbyInterval[]); setStatus('') }
  }
  const end = useMemo(() => new Date(start.getTime() + hours * 60 * 60000), [start, hours])
  const candidates = useMemo(() => rankCandidates(profiles, intervals, start, end), [profiles, intervals, start, end])
  const windows = useMemo(() => buildWindows(profiles, intervals, start), [profiles, intervals, start])
  const selectedCandidates = candidates.filter((candidate) => selected.includes(candidate.id))

  useEffect(() => {
    if (!profiles.length || !intervals.length) return
    const suggested = rankCandidates(profiles, intervals, start, end).filter((candidate) => candidate.fullyFree).slice(0, 5).map((candidate) => candidate.id)
    setSelected((current) => current.length ? current.filter((id) => candidates.some((candidate) => candidate.id === id)) : suggested)
  }, [start, end, profiles, intervals])

  function applyWindow(window: Window) { setStart(window.start); setHours(Math.max(1, Math.min(3, Math.round((window.end.getTime() - window.start.getTime()) / 3600000)))) }
  async function copyMessage() { await navigator.clipboard.writeText(copyableMessage(selectedCandidates, start, end)); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }
  async function signIn() { await createClient().auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: `${window.location.origin}/auth/callback?returnTo=/find-lobby` } }) }

  if (!user) return <main className="min-h-screen bg-background text-foreground"><Header /><section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 text-center"><Users className="text-amber-400" /><h1 className="mt-5 text-3xl font-semibold">Find a lobby</h1><p className="mt-3 text-sm text-muted-foreground">{status}</p><Button className="mt-7" onClick={signIn}><LogIn data-icon="inline-start" /> Sign in with Discord</Button>{process.env.NODE_ENV !== 'production' && <Button variant="link" size="sm" onClick={async () => { if (await startDevelopmentSession()) window.location.reload() }}>Use development test mode</Button>}</section></main>

  return <main className="min-h-screen bg-background text-foreground"><Header /><div className="mx-auto max-w-6xl px-4 py-7 sm:px-8"><p className="mb-2 text-sm font-medium text-amber-400">Lobby planner</p><h1 className="text-3xl font-semibold">Find a lobby</h1><p className="mt-2 text-sm text-muted-foreground">Ranked by confirmed free time first. Unknown availability stays potential, never confirmed.</p>{status && <p className="mt-5 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{status}</p>}<section className="mt-7 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[1fr_160px_auto] sm:items-end"><label className="grid gap-2 text-sm font-medium">Session start<input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" type="datetime-local" value={localInputValue(start)} onChange={(event) => { const next = fromLocalInput(event.target.value); if (!Number.isNaN(next.getTime())) { setStart(next); setHours(Math.max(1, Math.min(3, defaultSessionDuration(intervals, user.id, next) / 60))) } }} /></label><label className="grid gap-2 text-sm font-medium">Duration (hours)<input className="h-10 rounded-lg border border-input bg-background px-3 text-sm" type="number" min="1" max="3" step="0.5" value={hours} onChange={(event) => setHours(Math.max(1, Math.min(3, Number(event.target.value) || 1)))} /></label><Button variant="outline" onClick={() => void load()}>Refresh players</Button></section><section className="mt-7"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Best times today</h2><p className="mt-1 text-sm text-muted-foreground">Contiguous windows of at least one hour.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3">{windows.length ? windows.map((window) => <button key={`${window.start.toISOString()}-${window.end.toISOString()}`} onClick={() => applyWindow(window)} className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-amber-300"><p className="font-medium">{window.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – {window.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p><p className="mt-2 text-xs text-muted-foreground">{window.free} confirmed free · {window.potential} potential fill{window.potential === 1 ? '' : 's'}</p></button>) : <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">Add availability to see recommended windows.</p>}</div></section><section className="mt-8"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold">Players for {start.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.length} selected · {formatDuration(hours * 60)} session</p></div><Button onClick={() => void copyMessage()} disabled={!selectedCandidates.length}><Clipboard data-icon="inline-start" />{copied ? 'Copied' : 'Copy Discord message'}</Button></div><div className="mt-4 grid gap-3">{candidates.map((candidate) => <button key={candidate.id} onClick={() => setSelected((current) => current.includes(candidate.id) ? current.filter((id) => id !== candidate.id) : [...current, candidate.id])} className={`rounded-2xl border p-4 text-left ${selected.includes(candidate.id) ? 'border-amber-300 bg-amber-300/10' : 'border-border bg-card'}`}><div className="flex items-center justify-between gap-4"><div><p className="font-medium">{candidate.display_name}</p><p className="mt-1 text-xs text-muted-foreground">{formatDuration(candidate.freeMinutes)} confirmed free · {formatScore(candidate.score)} score · interest {candidate.default_interest}/4</p></div><span className={`flex size-8 items-center justify-center rounded-full ${selected.includes(candidate.id) ? 'bg-amber-300 text-amber-950' : 'bg-muted'}`}>{selected.includes(candidate.id) ? <Check /> : ''}</span></div><div className="mt-4 flex h-8 overflow-hidden rounded-lg bg-muted">{candidate.segments.map((segment, index) => <span key={`${candidate.id}-${index}`} title={`${stateLabel(segment.state)} · ${formatDuration(segment.minutes)}`} className={`${stateTone(segment.state)} h-full`} style={{ width: `${(segment.minutes / (hours * 60)) * 100}%` }} />)}</div><div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>Free</span><span>Busy</span><span>Unset</span></div></button>)}</div></section></div></main>
}
function buildWindows(profiles: LobbyProfile[], intervals: LobbyInterval[], anchor: Date): Window[] { const day = new Date(anchor); day.setHours(0, 0, 0, 0); const points = new Set<number>([day.getTime(), new Date(day.getTime() + 86400000).getTime()]); intervals.forEach((item) => { const left = new Date(item.starts_at).getTime(); const right = new Date(item.ends_at).getTime(); if (left >= day.getTime() && left < day.getTime() + 86400000) points.add(left); if (right > day.getTime() && right <= day.getTime() + 86400000) points.add(right) }); const sorted = [...points].sort((a, b) => a - b); const windows: Window[] = []; for (let i = 0; i < sorted.length - 1; i++) for (let j = i + 1; j < sorted.length; j++) { const start = new Date(sorted[i]); const end = new Date(sorted[j]); if (end.getTime() - start.getTime() < 3600000 || end.getTime() - start.getTime() > 10800000) continue; const ranked = rankCandidates(profiles, intervals, start, end); windows.push({ start, end, free: ranked.filter((candidate) => candidate.fullyFree).length, potential: ranked.filter((candidate) => !candidate.fullyFree && !candidate.segments.some((segment) => segment.state === 'busy')).length }) } return windows.sort((a, b) => b.free - a.free || b.potential - a.potential || a.start.getTime() - b.start.getTime()).slice(0, 6) }
function nextHour(date: Date) { const next = new Date(date); next.setMinutes(0, 0, 0); next.setHours(next.getHours() + 1); return next }
function Header() { return <header className="flex items-center justify-between border-b border-border/70 px-4 py-4 sm:px-8"><a href="/" className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-amber-300 font-black text-amber-950">P</span><span className="font-bold">PWP</span></a><nav className="flex items-center gap-4 text-sm"><a href="/schedule">Play</a><a className="text-muted-foreground hover:text-foreground" href="/availability">Plan</a><a className="text-amber-400" href="/find-lobby">Find a Lobby</a></nav></header> }

