import type { TextIndex } from './textIndex'
import type { Mark } from './types'

const MARK = 'articulater-mark'
const OVERLAP = 'articulater-mark-overlap'
const ACTIVE = 'articulater-mark-active'

function supported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
}

/** CSS Custom Highlight API でMarkを描く。本文のDOMは変更しない（D10・D13） */
export function paintHighlights(index: TextIndex, marks: Mark[], activeId: string | undefined) {
  if (!supported()) return
  const visible = marks.filter((m) => !m.lost)
  const toRanges = (spans: { start: number; end: number }[]) =>
    spans.map((s) => index.rangeFor(s.start, s.end)).filter((r): r is Range => r !== undefined)

  CSS.highlights.set(MARK, new Highlight(...toRanges(visible)))
  CSS.highlights.set(OVERLAP, new Highlight(...toRanges(overlapSpans(visible))))
  const active = visible.find((m) => m.id === activeId)
  CSS.highlights.set(ACTIVE, new Highlight(...toRanges(active ? [active] : [])))
}

export function clearHighlights() {
  if (!supported()) return
  for (const name of [MARK, OVERLAP, ACTIVE]) CSS.highlights.delete(name)
}

/** 2つ以上のMarkが重なっている区間 */
export function overlapSpans(marks: { start: number; end: number }[]): { start: number; end: number }[] {
  const events: [number, number][] = []
  for (const m of marks) events.push([m.start, 1], [m.end, -1])
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const spans: { start: number; end: number }[] = []
  let depth = 0
  let from = 0
  for (const [at, delta] of events) {
    if (depth >= 2 && at > from) spans.push({ start: from, end: at })
    depth += delta
    from = at
  }
  return spans
}
