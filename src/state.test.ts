import { describe, expect, it } from 'vitest'
import type { Mark } from './marks/types'
import { appReducer, initialAppState, reviewReducer, type Review } from './state'

const mark = (id: string): Mark => ({
  id,
  start: 0,
  end: 1,
  quote: 'q',
  prefix: '',
  suffix: '',
  contextBefore: '',
  contextAfter: '',
  headingPath: [],
  startLine: 1,
  endLine: 1,
  inCode: false,
  memo: '',
  lost: false,
})

const doc = (path: string) => ({ path, name: path, source: '' })

describe('reviewReducer', () => {
  it('Undoで直前のMarkを取り消し、削除も元に戻せる', () => {
    let s: Review = { marks: [], history: [] }
    s = reviewReducer(s, { type: 'add', mark: mark('1') })
    s = reviewReducer(s, { type: 'add', mark: mark('2') })
    s = reviewReducer(s, { type: 'undo' })
    expect(s.marks.map((m) => m.id)).toEqual(['1'])
    s = reviewReducer(s, { type: 'memo', id: '1', memo: 'メモ' })
    s = reviewReducer(s, { type: 'remove', id: '1' })
    expect(s.marks).toEqual([])
    s = reviewReducer(s, { type: 'undo' })
    expect(s.marks).toEqual([{ ...mark('1'), memo: 'メモ' }])
    s = reviewReducer(s, { type: 'undo' })
    s = reviewReducer(s, { type: 'undo' })
    expect(s.marks).toEqual([])
  })

  it('「新しいReviewを始める」で全Markを消し、Undoで戻せる', () => {
    let s: Review = { marks: [mark('1'), mark('2')], history: [] }
    s = reviewReducer(s, { type: 'clear' })
    expect(s.marks).toEqual([])
    s = reviewReducer(s, { type: 'undo' })
    expect(s.marks.map((m) => m.id)).toEqual(['1', '2'])
  })
})

describe('appReducer', () => {
  it('同じファイルをもう一度開くと、既存のタブに切り替える', () => {
    let s = appReducer(initialAppState, { type: 'open', doc: doc('a.md'), marks: [] })
    const first = s.activeId
    s = appReducer(s, { type: 'open', doc: doc('b.md'), marks: [] })
    s = appReducer(s, { type: 'open', doc: doc('a.md'), marks: [mark('x')] })
    expect(s.tabs).toHaveLength(2)
    expect(s.activeId).toBe(first)
    expect(s.tabs[0].marks).toEqual([])
  })

  it('アクティブなタブを閉じると、隣のタブに切り替わる', () => {
    let s = appReducer(initialAppState, { type: 'open', doc: doc('a.md'), marks: [] })
    s = appReducer(s, { type: 'open', doc: doc('b.md'), marks: [] })
    s = appReducer(s, { type: 'close', id: s.activeId! })
    expect(s.tabs.map((t) => t.doc.path)).toEqual(['a.md'])
    expect(s.activeId).toBe(s.tabs[0].id)
    s = appReducer(s, { type: 'close', id: s.activeId! })
    expect(s.activeId).toBeUndefined()
  })

  it('外部で更新されたタブに印を付け、再読込で外す', () => {
    let s = appReducer(initialAppState, { type: 'open', doc: doc('a.md'), marks: [] })
    s = appReducer(s, { type: 'stale', path: 'a.md' })
    expect(s.tabs[0].stale).toBe(true)
    s = appReducer(s, { type: 'reload', tabId: s.tabs[0].id, doc: { ...doc('a.md'), source: '新' }, marks: [] })
    expect(s.tabs[0].stale).toBe(false)
    expect(s.tabs[0].doc.source).toBe('新')
  })
})
