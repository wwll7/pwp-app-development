'use client'

import { useState } from 'react'
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Gamepad2,
  Menu,
  MessageSquareText,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'

const navigation = [
  { label: 'Overview', icon: Sparkles },
  { label: 'Availability', icon: CalendarDays },
  { label: 'Find a lobby', icon: Users },
  { label: 'Discord & events', icon: MessageSquareText },
]

const teammates = [
  { name: 'Mia', initials: 'MI', status: 'Free', detail: 'Tonight · 8:00–11:00 PM', tone: 'free' },
  { name: 'Jordan', initials: 'JO', status: 'Free', detail: 'Tonight · 8:30–10:30 PM', tone: 'free' },
  { name: 'Riley', initials: 'RI', status: 'Busy', detail: 'Busy until 9:15 PM', tone: 'busy' },
  { name: 'Sam', initials: 'SA', status: 'Unset', detail: 'No availability yet', tone: 'unset' },
]

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-card/35 px-5 py-6 lg:flex lg:flex-col">
          <Brand />
          <nav aria-label="Primary navigation" className="mt-12 flex flex-col gap-1">
            <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
            {navigation.map((item, index) => (
              <NavItem key={item.label} item={item} active={index === 0} />
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-border bg-background/70 p-4">
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck /></div>
            <p className="text-sm font-semibold">Your availability is private</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Only your team can see your schedule.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex h-16 items-center justify-between border-b border-border/70 px-4 sm:px-8">
            <div className="flex items-center gap-3 lg:hidden"><Brand compact /></div>
            <div className="hidden text-sm text-muted-foreground sm:block">Tuesday, October 14, 2026</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex"><Settings2 data-icon="inline-start" /> Settings</Button>
              <button aria-label="Open navigation" className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
              <div className="flex size-9 items-center justify-center rounded-full bg-amber-300 text-xs font-bold text-amber-950">AK</div>
            </div>
          </header>

          {menuOpen && <div className="border-b border-border bg-card px-4 py-3 lg:hidden"><nav aria-label="Mobile navigation" className="flex flex-col gap-1">{navigation.map((item, index) => <NavItem key={item.label} item={item} active={index === 0} />)}</nav></div>}

          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
            <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div><p className="mb-2 text-sm font-medium text-amber-500">PWP workspace</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ready when your squad is.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">See who is free, shape a session, and get your lobby into Discord without the back-and-forth.</p></div>
              <Button size="lg" className="w-full sm:w-auto"><Plus data-icon="inline-start" /> Plan a session</Button>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
              <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4"><div><div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="size-2 rounded-full bg-emerald-400" /> Next best window</div><h2 className="text-xl font-semibold">Tonight looks promising</h2><p className="mt-1 text-sm text-muted-foreground">Four players have shared availability after 8 PM.</p></div><div className="hidden size-11 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400 sm:flex"><Clock3 /></div></div>
                <div className="mt-6 rounded-xl border border-border/80 bg-background/70 p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Tuesday, October 14</p><p className="mt-1 text-xs text-muted-foreground">8:30 PM · 2 hours</p></div><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">4 likely</span></div><div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted"><span className="w-[58%] bg-emerald-400" /><span className="w-[17%] bg-amber-400" /><span className="w-[25%] bg-red-400/70" /></div><div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>Free 7</span><span>Unset 2</span><span>Busy 3</span></div></div>
                <button className="mt-5 flex w-full items-center justify-between text-sm font-medium text-amber-400 hover:text-amber-300">Review availability <ChevronRight /></button>
              </section>

              <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Squad</p><h2 className="mt-2 text-xl font-semibold">Your players</h2></div><span className="text-sm text-muted-foreground">12 total</span></div><div className="mt-5 flex flex-col gap-3">{teammates.map((player) => <div key={player.name} className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{player.initials}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium">{player.name}</p><span className={`size-1.5 rounded-full ${player.tone === 'free' ? 'bg-emerald-400' : player.tone === 'busy' ? 'bg-red-400' : 'bg-amber-400'}`} /><span className="text-xs text-muted-foreground">{player.status}</span></div><p className="truncate text-xs text-muted-foreground">{player.detail}</p></div></div>)}</div><button className="mt-5 flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-300">Manage squad <ChevronRight /></button></section>
            </div>

            <section className="mt-4 rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><CalendarDays className="text-amber-400" /><h2 className="text-xl font-semibold">Keep your availability current</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Import a calendar or paint your weekly schedule so PWP can find better windows for everyone.</p></div><Button variant="outline" className="w-full sm:w-auto">Open availability <ChevronRight data-icon="inline-end" /></Button></div></section>

            <div className="mt-8 flex flex-col gap-2 border-t border-border/70 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2"><Gamepad2 /> PWP · Plan. Play. Win.</span><span>Availability is always editable before saving.</span></div>
          </div>
        </section>
      </div>
    </main>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-amber-300 text-sm font-black text-amber-950">P</div>{!compact && <div><p className="font-bold tracking-tight">PWP</p><p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Play together</p></div>}</div>
}

function NavItem({ item, active }: { item: (typeof navigation)[number]; active: boolean }) {
  const Icon = item.icon
  return <button className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${active ? 'bg-amber-300/15 text-amber-300' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon /><span>{item.label}</span></button>
}


