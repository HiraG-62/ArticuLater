import { describe, expect, it } from 'vitest'
import type { Mark } from './marks/types'
import { initialState, reviewReducer } from './state'

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

describe('reviewReducer', () => {
  it('Undoで直前のMarkを取り消し、削除も元に戻せる', () => {
    let s = initialState({ name: 'a.md', source: '' })
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
})
