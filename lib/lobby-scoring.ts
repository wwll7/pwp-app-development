export type AvailabilityState = 'free' | 'busy' | 'unset'

export type LobbyInterval = {
  player_id: string
  starts_at: string
  ends_at: string
  state: AvailabilityState
}

export type LobbyProfile = {
  id: string
  display_name: string
  discord_user_id: string
  default_interest: number
}

export type Segment = { state: AvailabilityState; minutes: number }
export type RankedCandidate = LobbyProfile & {
  freeMinutes: number
  score: number
  segments: Segment[]
  fullyFree: boolean
}

const POINTS = { free: 5, busy: 0 } as const

export function rankCandidates(profiles: LobbyProfile[], intervals: LobbyInterval[], start: Date, end: Date): RankedCandidate[] {
  return profiles.map((profile) => {
    const segments = segmentAvailability(profile.id, intervals, start, end)
    const freeMinutes = segments.filter((segment) => segment.state === 'free').reduce((sum, segment) => sum + segment.minutes, 0)
    const score = segments.reduce((sum, segment) => sum + (segment.minutes / 60) * (segment.state === 'unset' ? profile.default_interest : POINTS[segment.state]), 0)
    const fullyFree = segments.length > 0 && segments.every((segment) => segment.state === 'free')
    return { ...profile, freeMinutes, score, segments, fullyFree }
  }).sort((a, b) => b.freeMinutes - a.freeMinutes || b.score - a.score || b.default_interest - a.default_interest || a.display_name.localeCompare(b.display_name))
}

export function segmentAvailability(playerId: string, intervals: LobbyInterval[], start: Date, end: Date): Segment[] {
  const startMs = start.getTime(); const endMs = end.getTime()
  if (!(endMs > startMs)) return []
  const playerIntervals = intervals.filter((item) => item.player_id === playerId)
  const points = new Set<number>([startMs, endMs])
  for (const item of playerIntervals) {
    const left = Math.max(startMs, new Date(item.starts_at).getTime())
    const right = Math.min(endMs, new Date(item.ends_at).getTime())
    if (right > left) { points.add(left); points.add(right) }
  }
  const sorted = [...points].sort((a, b) => a - b)
  const segments: Segment[] = []
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index]; const right = sorted[index + 1]
    const matches = playerIntervals.filter((item) => new Date(item.starts_at).getTime() < right && new Date(item.ends_at).getTime() > left)
    const state: AvailabilityState = matches.some((item) => item.state === 'busy') ? 'busy' : matches.some((item) => item.state === 'free') ? 'free' : 'unset'
    const minutes = (right - left) / 60000
    const previous = segments[segments.length - 1]
    if (previous && previous.state === state) previous.minutes += minutes
    else segments.push({ state, minutes })
  }
  return segments
}

export function formatDuration(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes))
  const hours = Math.floor(rounded / 60); const remainder = rounded % 60
  return hours === 0 ? `${remainder}m` : remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
}
export function defaultSessionDuration(intervals: LobbyInterval[], playerId: string, sessionStart: Date) {
  const nextBusy = intervals.filter((item) => item.player_id === playerId && item.state === 'busy' && new Date(item.starts_at).getTime() > sessionStart.getTime()).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]
  const availableMinutes = nextBusy ? (new Date(nextBusy.starts_at).getTime() - sessionStart.getTime()) / 60000 : 180
  return Math.min(180, Math.max(0, availableMinutes))
}

export function discordMentions(candidates: RankedCandidate[]) { return candidates.map((candidate) => candidate.discord_user_id ? `<@${candidate.discord_user_id}>` : '').filter(Boolean).join(' ') }
export function dayStart(date: Date) { const next = new Date(date); next.setHours(0, 0, 0, 0); return next }
export function addDays(date: Date, amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); return next }
export function localInputValue(date: Date) { const offset = date.getTimezoneOffset() * 60000; return new Date(date.getTime() - offset).toISOString().slice(0, 16) }
export function fromLocalInput(value: string) { return new Date(value) }
export function stateTone(state: AvailabilityState) { return state === 'free' ? 'bg-emerald-400' : state === 'busy' ? 'bg-red-400' : 'bg-amber-300' }
export function stateLabel(state: AvailabilityState) { return state[0].toUpperCase() + state.slice(1) }
export function hourLabel(hour: number) { return `${hour % 12 || 12}${hour >= 12 ? 'p' : 'a'}` }
export function minutesUntilEnd(start: Date, end: Date) { return Math.max(60, Math.min(180, (end.getTime() - start.getTime()) / 60000)) }
export function formatScore(score: number) { return score.toFixed(1).replace('.0', '') }
export type CandidateWindow = { start: Date; end: Date; free: number; potential: number }

export function candidateWindows(profiles: LobbyProfile[], intervals: LobbyInterval[], day: Date): CandidateWindow[] {
  const dayStartAt = dayStart(day); const dayEndAt = new Date(dayStartAt); dayEndAt.setDate(dayEndAt.getDate() + 1)
  const points = new Set<number>([dayStartAt.getTime(), dayEndAt.getTime()])
  for (const interval of intervals) {
    const left = Math.max(dayStartAt.getTime(), new Date(interval.starts_at).getTime())
    const right = Math.min(dayEndAt.getTime(), new Date(interval.ends_at).getTime())
    if (right > left) { points.add(left); points.add(right) }
  }
  const boundaries = [...points].sort((a, b) => a - b)
  const windows: CandidateWindow[] = []
  for (let startIndex = 0; startIndex < boundaries.length - 1; startIndex += 1) {
    for (let endIndex = startIndex + 1; endIndex < boundaries.length; endIndex += 1) {
      const windowStart = new Date(boundaries[startIndex]); const windowEnd = new Date(boundaries[endIndex])
      if (windowEnd.getTime() - windowStart.getTime() < 60 * 60000) continue
      const ranked = rankCandidates(profiles, intervals, windowStart, windowEnd)
      const free = ranked.filter((candidate) => candidate.fullyFree).length
      const potential = ranked.filter((candidate) => !candidate.segments.some((segment) => segment.state === 'busy') && !candidate.fullyFree).length
      windows.push({ start: windowStart, end: windowEnd, free, potential })
    }
  }
  const rankedWindows = windows.sort((a, b) => b.free - a.free || b.potential - a.potential || a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime())
  const selected: CandidateWindow[] = []
  for (const window of rankedWindows) {
    if (selected.every((chosen) => window.end.getTime() <= chosen.start.getTime() || window.start.getTime() >= chosen.end.getTime())) selected.push(window)
    if (selected.length === 5) break
  }
  return selected
}

export function copyableMessage(candidates: RankedCandidate[], start: Date, end: Date) { return `Valorant session · ${start.toLocaleString()}–${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}\n${discordMentions(candidates)}` }
