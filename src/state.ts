import type { Mark } from './marks/types'
import type { LoadedDocument } from './platform/types'

type HistoryEntry = { kind: 'add'; mark: Mark } | { kind: 'remove'; mark: Mark } | { kind: 'clear'; marks: Mark[] }

/** 1つの文書のReview（D4：1ファイル＝1 Review） */
export interface Review {
  marks: Mark[]
  /** Undo用の履歴（Markの作成・削除・全消去。D1・D17） */
  history: HistoryEntry[]
}

export interface Tab extends Review {
  id: string
  doc: LoadedDocument
  /** 外部で更新されたが、まだ再読込していない（D6・D17） */
  stale: boolean
}

export interface AppState {
  tabs: Tab[]
  activeId: string | undefined
}

export type ReviewAction =
  | { type: 'add'; mark: Mark }
  | { type: 'remove'; id: string }
  | { type: 'memo'; id: string; memo: string }
  | { type: 'clear' }
  | { type: 'undo' }

export type AppAction =
  | { type: 'open'; doc: LoadedDocument; marks: Mark[] }
  | { type: 'activate'; id: string }
  | { type: 'close'; id: string }
  | { type: 'review'; tabId: string; action: ReviewAction }
  | { type: 'stale'; path: string }
  | { type: 'reload'; tabId: string; doc: LoadedDocument; marks: Mark[] }

export const initialAppState: AppState = { tabs: [], activeId: undefined }

export function reviewReducer<T extends Review>(review: T, action: ReviewAction): T {
  switch (action.type) {
    case 'add':
      return { ...review, marks: [...review.marks, action.mark], history: [...review.history, { kind: 'add', mark: action.mark }] }
    case 'remove': {
      const mark = review.marks.find((m) => m.id === action.id)
      if (!mark) return review
      return {
        ...review,
        marks: review.marks.filter((m) => m.id !== action.id),
        history: [...review.history, { kind: 'remove', mark }],
      }
    }
    case 'memo':
      return { ...review, marks: review.marks.map((m) => (m.id === action.id ? { ...m, memo: action.memo } : m)) }
    case 'clear':
      if (review.marks.length === 0) return review
      return { ...review, marks: [], history: [...review.history, { kind: 'clear', marks: review.marks }] }
    case 'undo': {
      const last = review.history[review.history.length - 1]
      if (!last) return review
      const history = review.history.slice(0, -1)
      switch (last.kind) {
        case 'add':
          return { ...review, marks: review.marks.filter((m) => m.id !== last.mark.id), history }
        case 'remove':
          // 削除を取り消すときは、削除時点のメモも含めて元に戻す
          return { ...review, marks: [...review.marks, last.mark], history }
        case 'clear':
          return { ...review, marks: [...review.marks, ...last.marks], history }
      }
    }
  }
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'open': {
      // すでに開いているファイルは、そのタブに切り替える（D17）
      const existing = state.tabs.find((t) => t.doc.path === action.doc.path)
      if (existing) return { ...state, activeId: existing.id }
      const tab: Tab = { id: crypto.randomUUID(), doc: action.doc, marks: action.marks, history: [], stale: false }
      return { tabs: [...state.tabs, tab], activeId: tab.id }
    }
    case 'activate':
      return { ...state, activeId: action.id }
    case 'close': {
      const index = state.tabs.findIndex((t) => t.id === action.id)
      if (index < 0) return state
      const tabs = state.tabs.filter((t) => t.id !== action.id)
      const activeId =
        state.activeId === action.id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? undefined) : state.activeId
      return { tabs, activeId }
    }
    case 'review':
      return { ...state, tabs: state.tabs.map((t) => (t.id === action.tabId ? reviewReducer(t, action.action) : t)) }
    case 'stale':
      return { ...state, tabs: state.tabs.map((t) => (t.doc.path === action.path ? { ...t, stale: true } : t)) }
    case 'reload':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.tabId ? { ...t, doc: action.doc, marks: action.marks, history: [], stale: false } : t,
        ),
      }
  }
}
