import * as ICALModule from 'ical.js'

const ICAL = ICALModule.default

export type ParsedCalendarEvent = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  localStart: string
  localEnd: string
  allDay: boolean
  recurring: boolean
  sourceKey: string
}

const MAX_EVENTS = 500
const HORIZON_DAYS = 90

export function parseCalendar(text: string, now = new Date()): ParsedCalendarEvent[] {
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('This does not look like a valid iCalendar file.')
  const component = new ICAL.Component(ICAL.parse(text))
  const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 86400000)
  const events: ParsedCalendarEvent[] = []
  for (const componentEvent of component.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(componentEvent)
    if (!event.startDate || !event.endDate) throw new Error(`Event "${event.summary || 'Untitled'}" is missing a start or end time.`)
    const iterator = event.iterator()
    let occurrence = iterator.next()
    let count = 0
    while (occurrence && count < MAX_EVENTS) {
      // getOccurrenceDetails applies RECURRENCE-ID overrides and RANGE=THISANDFUTURE
      // exceptions, then adds the event's actual iCalendar duration in its timezone.
      const occurrenceDetails = event.getOccurrenceDetails(occurrence)
      const startTime = occurrenceDetails.startDate
      const endTime = occurrenceDetails.endDate
      const start = startTime.toJSDate()
      const end = endTime.toJSDate()
      if (end > now && start < horizonEnd) {
        const recurrenceId = occurrence.toString()
        const key = `${event.uid || event.summary || 'event'}:${recurrenceId}`
        events.push({ id: key, title: occurrenceDetails.item?.summary || event.summary || 'Untitled event', startsAt: start.toISOString(), endsAt: end.toISOString(), localStart: formatLocal(startTime), localEnd: formatLocal(endTime), allDay: startTime.isDate, recurring: Boolean(componentEvent.hasProperty('rrule')), sourceKey: key })
        count += 1
      }
      occurrence = iterator.next()
      if (!event.isRecurring()) break
      if (occurrence && occurrence.toJSDate() >= horizonEnd) break
    }
  }
  return dedupe(events).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

function formatLocal(time: any) { return time.isDate ? 'All day' : time.toString().replace(/T/, ' ').replace(/Z$/, '') }
function dedupe(events: ParsedCalendarEvent[]) { return [...new Map(events.map((event) => [event.sourceKey, event])).values()] }
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) { return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart) }
export const ICS_LIMITS = { maxBytes: 2_000_000, maxEvents: MAX_EVENTS, horizonDays: HORIZON_DAYS }
