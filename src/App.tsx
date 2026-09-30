import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { DocumentView } from './components/DocumentView'
import { EmptyState } from './components/EmptyState'
import { ExportMenu } from './components/ExportMenu'
import { MarkPanel } from './components/MarkPanel'
import { TabBar } from './components/TabBar'
import { exportReview } from './export/exportReview'
import { reanchor } from './marks/anchor'
import { compareMarks } from './marks/createMark'
import type { Mark } from './marks/types'
import { platform } from './platform'
import type { LoadedDocument } from './platform/types'
import { appReducer, initialAppState, type ReviewAction } from './state'

/** Markの変更を自動保存するまでの待ち時間（ミリ秒。D4） */
const SAVE_DELAY = 400

interface Toast {
  message: string
  action?: { label: string; run: () => void }
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState)
  const stateRef = useRef(state)
  stateRef.current = state
  const [panelOpen, setPanelOpen] = useState(false)
  /** 現在のMark（直前に作成・移動・選択したMark。D20） */
  const [activeMarkId, setActiveMarkId] = useState<string | undefined>()
  const [scrollRequest, setScrollRequest] = useState<{ id: string; nonce: number } | undefined>()
  const [popoverRequest, setPopoverRequest] = useState<{ id: string; nonce: number } | undefined>()
  const [exportOpen, setExportOpen] = useState(false)
  const [toast, setToast] = useState<Toast | undefined>()
  const [exportText, setExportText] = useState<string | undefined>()

  const activeTab = state.tabs.find((t) => t.id === state.activeId)
  const sorted = useMemo(() => [...(activeTab?.marks ?? [])].sort(compareMarks), [activeTab?.marks])

  const showError = useCallback((e: unknown) => {
    setToast({ message: `ファイルを開けませんでした：${e instanceof Error ? e.message : String(e)}` })
  }, [])

  /** 文書を開く。保存しておいたReviewがあれば、Markを探し直して復元する（D4・D5） */
  const openDocuments = useCallback(async (docs: LoadedDocument[]) => {
    for (const doc of docs) {
      const open = stateRef.current.tabs.some((t) => t.doc.path === doc.path)
      const stored = open ? null : await platform.loadReview(doc.path).catch(() => null)
      dispatch({ type: 'open', doc, marks: stored ? reanchor(stored.marks, doc.source) : [] })
    }
  }, [])

  const openDialog = useCallback(() => {
    platform.openDialog().then(openDocuments).catch(showError)
  }, [openDocuments, showError])

  useEffect(() => {
    platform.initialDocuments().then(openDocuments).catch(showError)
    return platform.onOpenRequest((docs) => void openDocuments(docs))
  }, [openDocuments, showError])

  // 開いている文書の外部での変更を監視する（D6）
  const watchesRef = useRef(new Map<string, () => void>())
  useEffect(() => {
    const watches = watchesRef.current
    const paths = new Set(state.tabs.map((t) => t.doc.path))
    for (const path of paths) {
      if (!watches.has(path)) watches.set(path, platform.watch(path, () => dispatch({ type: 'stale', path })))
    }
    for (const [path, unwatch] of watches) {
      if (!paths.has(path)) {
        unwatch()
        watches.delete(path)
      }
    }
  }, [state.tabs])

  // Markの変更を自動保存する（D4）
  const savedRef = useRef(new Map<string, Mark[]>())
  const timersRef = useRef(new Map<string, number>())
  useEffect(() => {
    for (const tab of state.tabs) {
      if (savedRef.current.get(tab.doc.path) === tab.marks) continue
      savedRef.current.set(tab.doc.path, tab.marks)
      window.clearTimeout(timersRef.current.get(tab.doc.path))
      const timer = window.setTimeout(() => {
        platform
          .saveReview(tab.doc.path, { version: 1, marks: tab.marks })
          .catch(() => setToast({ message: 'Markを保存できませんでした' }))
      }, SAVE_DELAY)
      timersRef.current.set(tab.doc.path, timer)
    }
  }, [state.tabs])

  const review = useCallback((action: ReviewAction) => {
    const tabId = stateRef.current.activeId
    if (tabId) dispatch({ type: 'review', tabId, action })
  }, [])
  const onCreate = useCallback(
    (mark: Mark) => {
      review({ type: 'add', mark })
      setActiveMarkId(mark.id)
    },
    [review],
  )
  const onMemo = useCallback((id: string, memo: string) => review({ type: 'memo', id, memo }), [review])
  const onDelete = useCallback((id: string) => review({ type: 'remove', id }), [review])

  const reload = useCallback(
    async (tabId: string) => {
      const tab = stateRef.current.tabs.find((t) => t.id === tabId)
      if (!tab) return
      try {
        const doc = await platform.readDocument(tab.doc.path)
        dispatch({ type: 'reload', tabId, doc, marks: reanchor(tab.marks, doc.source) })
      } catch (e) {
        showError(e)
      }
    },
    [showError],
  )

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(undefined), toast.action ? 6000 : 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const exportContent = () => {
    if (!activeTab || activeTab.marks.length === 0) {
      setToast({ message: 'Markがまだありません' })
      return undefined
    }
    return exportReview(activeTab.doc.path, sorted)
  }

  const copyExport = () => {
    const text = exportContent()
    if (text === undefined) return
    platform
      .copyText(text)
      .then(() => setToast({ message: 'Exportをクリップボードにコピーしました' }))
      .catch(() => setExportText(text))
  }

  const saveExport = () => {
    const text = exportContent()
    if (text === undefined || !activeTab) return
    platform
      .saveExport(activeTab.doc.path, text)
      .then((saved) => saved && setToast({ message: 'Exportを保存しました' }))
      .catch((e) => setToast({ message: `保存できませんでした：${e instanceof Error ? e.message : String(e)}` }))
  }

  // タブを切り替えたら、現在のMarkを解除する
  useEffect(() => setActiveMarkId(undefined), [state.activeId])

  /** 次（dir=1）／前（dir=-1）のMarkへ移動する。端まで行ったら反対側に戻る（D20） */
  const moveMark = (dir: 1 | -1) => {
    const visible = sorted.filter((m) => !m.lost)
    if (visible.length === 0) return
    const i = visible.findIndex((m) => m.id === activeMarkId)
    const next = i < 0 ? visible[dir > 0 ? 0 : visible.length - 1] : visible[(i + dir + visible.length) % visible.length]
    setActiveMarkId(next.id)
    setScrollRequest({ id: next.id, nonce: Date.now() })
  }

  const cycleTab = (dir: 1 | -1) => {
    const { tabs, activeId } = stateRef.current
    if (tabs.length < 2) return
    const i = tabs.findIndex((t) => t.id === activeId)
    dispatch({ type: 'activate', id: tabs[(i + dir + tabs.length) % tabs.length].id })
  }

  // キーボードショートカット（D16・D20）。毎回の描画で最新の状態を使うよう登録し直す
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, [contenteditable]') !== null
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const plainCtrl = ctrl && !e.shiftKey && !e.altKey

      // WebView2 の再読み込みで、読んでいる状態が失われないようにする
      if (e.key === 'F5' || (ctrl && key === 'r')) {
        e.preventDefault()
        if (e.key === 'F5' && activeTab?.stale) void reload(activeTab.id)
        return
      }
      if (ctrl && e.key === 'Tab') {
        e.preventDefault()
        cycleTab(e.shiftKey ? -1 : 1)
        return
      }
      if (ctrl && e.shiftKey && !e.altKey && key === 'c') {
        e.preventDefault()
        if (activeTab) copyExport()
        return
      }
      if (e.key === 'F8' && !ctrl && !e.altKey) {
        e.preventDefault()
        moveMark(e.shiftKey ? -1 : 1)
        return
      }
      if (plainCtrl) {
        const run = {
          // 入力欄の中では文字の取り消しを優先する
          z: () => !typing && review({ type: 'undo' }),
          o: openDialog,
          w: () => activeTab && dispatch({ type: 'close', id: activeTab.id }),
          b: () => activeTab && setPanelOpen((open) => !open),
          e: () => activeTab && setExportOpen((open) => !open),
        }[key]
        if (run && !(key === 'z' && typing)) {
          e.preventDefault()
          run()
        }
        return
      }
      if ((key === 'm' || e.code === 'KeyM') && !ctrl && !e.altKey && !e.shiftKey && !typing && !e.isComposing) {
        if (activeMarkId && activeTab?.marks.some((m) => m.id === activeMarkId && !m.lost)) {
          e.preventDefault()
          setPopoverRequest({ id: activeMarkId, nonce: Date.now() })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const startNewReview = () => {
    const tabId = state.activeId
    if (!tabId) return
    dispatch({ type: 'review', tabId, action: { type: 'clear' } })
    // 「元に戻す」は、消したMarkを戻すときだけ効かせる（その後に別の操作をしていたら何もしない）
    const restore = () => {
      const tab = stateRef.current.tabs.find((t) => t.id === tabId)
      if (tab?.history.at(-1)?.kind === 'clear') dispatch({ type: 'review', tabId, action: { type: 'undo' } })
    }
    setToast({ message: 'すべてのMarkを消しました', action: { label: '元に戻す', run: restore } })
  }

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">ArticuLater</span>
        <div className="toolbar-actions">
          <button type="button" className="button" title="開く（Ctrl+O）" onClick={openDialog}>
            開く
          </button>
          <button
            type="button"
            className="button"
            aria-pressed={panelOpen}
            disabled={!activeTab}
            title="Mark一覧（Ctrl+B）"
            onClick={() => setPanelOpen((open) => !open)}
          >
            Mark一覧
          </button>
          <ExportMenu
            open={exportOpen && !!activeTab}
            onOpenChange={setExportOpen}
            disabled={!activeTab} canSaveFile={platform.canSaveFile} onSave={saveExport} onCopy={copyExport} />
        </div>
      </header>

      {state.tabs.length > 0 && (
        <TabBar
          tabs={state.tabs}
          activeId={state.activeId}
          onActivate={(id) => dispatch({ type: 'activate', id })}
          onClose={(id) => dispatch({ type: 'close', id })}
        />
      )}

      <main className={panelOpen && activeTab ? 'workspace has-panel' : 'workspace'}>
        {state.tabs.length === 0 ? (
          <EmptyState onOpen={openDialog} />
        ) : (
          <div className="documents">
            {state.tabs.map((tab) => (
              <DocumentView
                key={tab.id}
                source={tab.doc.source}
                active={tab.id === state.activeId}
                stale={tab.stale}
                onReload={() => void reload(tab.id)}
                marks={tab.marks}
                activeId={tab.id === state.activeId ? activeMarkId : undefined}
                onActiveChange={setActiveMarkId}
                onCreate={onCreate}
                onMemo={onMemo}
                onDelete={onDelete}
                scrollRequest={tab.id === state.activeId ? scrollRequest : undefined}
                popoverRequest={tab.id === state.activeId ? popoverRequest : undefined}
              />
            ))}
          </div>
        )}
        {panelOpen && activeTab && (
          <MarkPanel
            marks={sorted}
            activeId={activeMarkId}
            onSelect={(id) => {
              setActiveMarkId(id)
              setScrollRequest({ id, nonce: Date.now() })
            }}
            onMemo={onMemo}
            onDelete={onDelete}
            onClear={startNewReview}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast.message}
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action?.run()
                setToast(undefined)
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {exportText !== undefined && (
        <div className="dialog-backdrop" onClick={() => setExportText(undefined)}>
          <div className="dialog" role="dialog" aria-label="Export" onClick={(e) => e.stopPropagation()}>
            <p className="dialog-text">クリップボードに書き込めませんでした。下の内容を選択してコピーしてください。</p>
            <label className="visually-hidden" htmlFor="export-text">
              Export
            </label>
            <textarea id="export-text" className="export-text" readOnly value={exportText} onFocus={(e) => e.target.select()} autoFocus />
            <button type="button" className="button" onClick={() => setExportText(undefined)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
