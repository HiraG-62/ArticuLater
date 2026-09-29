import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { renderMarkdown } from '../markdown/render'
import { buildMark, selectionOffsets } from '../marks/createMark'
import { clearHighlights, paintHighlights } from '../marks/highlight'
import { TextIndex } from '../marks/textIndex'
import type { Mark } from '../marks/types'
import { MarkPopover } from './MarkPopover'

/** ダブルクリックの後にトリプルクリックが続くかを待つ時間（ミリ秒） */
const MULTI_CLICK_WAIT = 450
/** これ以下の移動量ならドラッグではなくクリックとみなす（px） */
const CLICK_SLOP = 4

interface Props {
  source: string
  marks: Mark[]
  activeId: string | undefined
  onCreate: (mark: Mark) => void
  onMemo: (id: string, memo: string) => void
  onDelete: (id: string) => void
  /** 値が変わるたびに、そのMarkの位置へスクロールする */
  scrollRequest: { id: string; nonce: number } | undefined
}

interface Layout {
  dots: { id: string; x: number; y: number }[]
  ticks: { id: string; ratio: number }[]
}

let nextId = 1

export function DocumentView({ source, marks, activeId, onCreate, onMemo, onDelete, scrollRequest }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const indexRef = useRef<TextIndex | null>(null)
  const pressRef = useRef<{ x: number; y: number; plain: boolean } | null>(null)
  /** ダブルクリックでできた選択。トリプルクリックが続かなければMarkにする */
  const pendingRef = useRef<{ timer: number; range: Range } | undefined>(undefined)
  const marksRef = useRef(marks)
  marksRef.current = marks

  const [popover, setPopover] = useState<{ id: string; x: number; y: number } | undefined>()
  const [layout, setLayout] = useState<Layout>({ dots: [], ticks: [] })

  const rendered = useMemo(() => renderMarkdown(source), [source])

  // 本文のDOMはReactの再描画に任せず、直接差し込む（D16）
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.replaceChildren(rendered.root)
    indexRef.current = new TextIndex(rendered.root)
    scrollerRef.current?.scrollTo({ top: 0 })
    setPopover(undefined)
    return () => {
      if (pendingRef.current) window.clearTimeout(pendingRef.current.timer)
      pendingRef.current = undefined
      clearHighlights()
    }
  }, [rendered])

  useLayoutEffect(() => {
    const index = indexRef.current
    if (index) paintHighlights(index, marks, activeId ?? popover?.id)
  }, [marks, activeId, popover, rendered])

  const measure = useCallback(() => {
    const index = indexRef.current
    const content = contentRef.current
    if (!index || !content) return
    const box = content.getBoundingClientRect()
    const height = content.scrollHeight || 1
    const next: Layout = { dots: [], ticks: [] }
    for (const mark of marksRef.current) {
      if (mark.lost) continue
      const rects = index.rangeFor(mark.start, mark.end)?.getClientRects()
      if (!rects || rects.length === 0) continue
      const first = rects[0]
      const last = rects[rects.length - 1]
      next.ticks.push({ id: mark.id, ratio: (first.top - box.top) / height })
      if (mark.memo.trim() !== '') next.dots.push({ id: mark.id, x: last.right - box.left, y: last.top - box.top })
    }
    setLayout(next)
  }, [])

  useLayoutEffect(measure, [marks, rendered, measure])

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [measure])

  const createFromRange = useCallback(
    (range: Range) => {
      const index = indexRef.current
      if (!index) return
      const offsets = selectionOffsets(range, index)
      if (!offsets) return
      // まったく同じ範囲のMarkがすでにあれば、重複して作らない
      if (marksRef.current.some((m) => !m.lost && m.start === offsets.start && m.end === offsets.end)) return
      const mark = buildMark(`m${nextId++}`, offsets, index, rendered)
      if (mark) onCreate(mark)
    },
    [onCreate, rendered],
  )

  const markAtPoint = useCallback((x: number, y: number): Mark | undefined => {
    const index = indexRef.current
    if (!index) return undefined
    let hit: Mark | undefined
    for (const mark of marksRef.current) {
      if (mark.lost) continue
      const rects = index.rangeFor(mark.start, mark.end)?.getClientRects() ?? []
      const inside = Array.from(rects).some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)
      // 重なっている場合は、より短い（内側の）Markを選ぶ
      if (inside && (!hit || mark.end - mark.start < hit.end - hit.start)) hit = mark
    }
    return hit
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.popover')) return
    // 直前の選択が残っていると、その上からドラッグしたときに新しい選択が始まらないため解除する
    if (e.detail === 1 && !e.shiftKey) window.getSelection()?.removeAllRanges()
    pressRef.current = { x: e.clientX, y: e.clientY, plain: !e.ctrlKey && !e.metaKey }
    if (popover) setPopover(undefined)
  }

  // ダブルクリックの待機中に次の操作が始まったら、待たずに確定する。
  // トリプルクリックなら単語は捨て、それ以外（別の場所のクリックやCtrl+Zなど）は単語をすぐにMarkする
  useEffect(() => {
    const settle = (discard: boolean) => {
      const pending = pendingRef.current
      if (!pending) return
      window.clearTimeout(pending.timer)
      pendingRef.current = undefined
      if (!discard) createFromRange(pending.range)
    }
    const onMouseDown = (e: MouseEvent) => settle(e.detail >= 3)
    const onKeyDown = () => settle(false)
    window.addEventListener('mousedown', onMouseDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [createFromRange])

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      const press = pressRef.current
      pressRef.current = null
      if (!press || e.button !== 0) return
      // Ctrl+ドラッグは通常の選択（D16）
      if (!press.plain) return

      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y)
        if (moved > CLICK_SLOP) return
        const mark = markAtPoint(e.clientX, e.clientY)
        const content = contentRef.current
        if (mark && content) {
          const box = content.getBoundingClientRect()
          setPopover({ id: mark.id, x: e.clientX - box.left, y: e.clientY - box.top })
        }
        return
      }

      const range = selection.getRangeAt(0).cloneRange()
      if (e.detail === 2) {
        // トリプルクリックが続く可能性があるので、少し待ってから単語をMarkする
        const timer = window.setTimeout(() => {
          pendingRef.current = undefined
          createFromRange(range)
        }, MULTI_CLICK_WAIT)
        pendingRef.current = { timer, range }
      } else {
        createFromRange(range)
      }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [createFromRange, markAtPoint])

  useEffect(() => {
    if (!scrollRequest) return
    const scroller = scrollerRef.current
    const mark = marksRef.current.find((m) => m.id === scrollRequest.id)
    const rect = mark && indexRef.current?.rangeFor(mark.start, mark.end)?.getBoundingClientRect()
    if (!scroller || !rect) return
    const box = scroller.getBoundingClientRect()
    scroller.scrollTo({ top: scroller.scrollTop + rect.top - box.top - scroller.clientHeight / 3, behavior: 'smooth' })
  }, [scrollRequest])

  useEffect(() => {
    if (!popover) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(undefined)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [popover])

  const popoverMark = popover && marks.find((m) => m.id === popover.id)

  return (
    <div className="doc-pane">
      <div className="doc-scroller" ref={scrollerRef}>
        <div className="doc-content" ref={contentRef}>
          <div
            className="doc"
            ref={hostRef}
            onMouseDown={onMouseDown}
            onClick={(e) => {
              // 読んでいる最中にリンクで画面が切り替わらないようにする
              if ((e.target as HTMLElement).closest('a')) e.preventDefault()
            }}
            onDragStart={(e) => e.preventDefault()}
          />
          {layout.dots.map((dot) => (
            <span key={dot.id} className="memo-dot" style={{ left: dot.x, top: dot.y }} aria-hidden="true" />
          ))}
          {popover && popoverMark && (
            <MarkPopover
              mark={popoverMark}
              x={popover.x}
              y={popover.y}
              onMemo={(memo) => onMemo(popoverMark.id, memo)}
              onDelete={() => {
                onDelete(popoverMark.id)
                setPopover(undefined)
              }}
              onClose={() => setPopover(undefined)}
            />
          )}
        </div>
      </div>
      <div className="mark-rail" aria-hidden="true">
        {layout.ticks.map((tick) => (
          <span key={tick.id} className="mark-tick" style={{ top: `${tick.ratio * 100}%` }} />
        ))}
      </div>
    </div>
  )
}
