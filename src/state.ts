import type { Mark } from './marks/types'

export interface OpenDocument {
  name: string
  source: string
}

type HistoryEntry = { kind: 'add'; mark: Mark } | { kind: 'remove'; mark: Mark }

export interface ReviewState {
  doc: OpenDocument
  marks: Mark[]
  /** Undo用の履歴（Markの作成と削除のみ。D1） */
  history: HistoryEntry[]
}

export type ReviewAction =
  | { type: 'open'; doc: OpenDocument }
  | { type: 'add'; mark: Mark }
  | { type: 'remove'; id: string }
  | { type: 'memo'; id: string; memo: string }
  | { type: 'undo' }

export function initialState(doc: OpenDocument): ReviewState {
  return { doc, marks: [], history: [] }
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case 'open':
      return initialState(action.doc)
    case 'add':
      return { ...state, marks: [...state.marks, action.mark], history: [...state.history, { kind: 'add', mark: action.mark }] }
    case 'remove': {
      const mark = state.marks.find((m) => m.id === action.id)
      if (!mark) return state
      return {
        ...state,
        marks: state.marks.filter((m) => m.id !== action.id),
        history: [...state.history, { kind: 'remove', mark }],
      }
    }
    case 'memo':
      return { ...state, marks: state.marks.map((m) => (m.id === action.id ? { ...m, memo: action.memo } : m)) }
    case 'undo': {
      const last = state.history[state.history.length - 1]
      if (!last) return state
      const history = state.history.slice(0, -1)
      if (last.kind === 'add') return { ...state, marks: state.marks.filter((m) => m.id !== last.mark.id), history }
      // 削除を取り消すときは、削除時点のメモも含めて元に戻す
      return { ...state, marks: [...state.marks, last.mark], history }
    }
  }
}
