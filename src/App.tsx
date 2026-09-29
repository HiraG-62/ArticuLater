import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { DocumentView } from './components/DocumentView'
import { MarkPanel } from './components/MarkPanel'
import { exportReview } from './export/exportReview'
import { compareMarks } from './marks/createMark'
import type { Mark } from './marks/types'
import sample from './sample/sample.md?raw'
import { initialState, reviewReducer } from './state'

const MARKDOWN_FILE = /\.(md|markdown|mdown|mkd)$/i

export function App() {
  const [state, dispatch] = useReducer(reviewReducer, { name: 'sample-design.md', source: sample }, initialState)
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | undefined>()
  const [scrollRequest, setScrollRequest] = useState<{ id: string; nonce: number } | undefined>()
  const [toast, setToast] = useState<string | undefined>()
  const [exportText, setExportText] = useState<string | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sorted = useMemo(() => [...state.marks].sort(compareMarks), [state.marks])

  const onCreate = useCallback((mark: Mark) => dispatch({ type: 'add', mark }), [])
  const onMemo = useCallback((id: string, memo: string) => dispatch({ type: 'memo', id, memo }), [])
  const onDelete = useCallback((id: string) => dispatch({ type: 'remove', id }), [])

  const openFile = useCallback(async (file: File) => {
    if (!MARKDOWN_FILE.test(file.name)) {
      setToast('Markdownファイル（.md）を選んでください')
      return
    }
    dispatch({ type: 'open', doc: { name: file.name, source: await file.text() } })
    setActiveId(undefined)
  }, [])

  // Ctrl+Z で直前のMark操作を取り消す（D1・D16）。入力欄の中では文字の取り消しを優先する
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      e.preventDefault()
      dispatch({ type: 'undo' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ウィンドウへのドラッグ＆ドロップで開く（D12）
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files[0]
      if (!file) return
      e.preventDefault()
      void openFile(file)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [openFile])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(undefined), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const copyExport = async () => {
    if (state.marks.length === 0) {
      setToast('Markがまだありません')
      return
    }
    const text = exportReview(state.doc.name, sorted)
    try {
      await navigator.clipboard.writeText(text)
      setToast('Exportをクリップボードにコピーしました')
    } catch {
      setExportText(text)
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-title">
          <span className="brand">ArticuLater</span>
          <span className="file-name" title={state.doc.name}>
            {state.doc.name}
          </span>
        </div>
        <p className="toolbar-hint">
          選択でMark ・ <kbd>Ctrl</kbd>+ドラッグで通常選択 ・ <kbd>Ctrl</kbd>+<kbd>Z</kbd>で取り消し ・ Markをクリックでメモ／削除
        </p>
        <div className="toolbar-actions">
          <button type="button" className="button" onClick={() => fileInputRef.current?.click()}>
            開く
          </button>
          <button
            type="button"
            className="button"
            aria-pressed={panelOpen}
            onClick={() => {
              setPanelOpen((open) => !open)
              setActiveId(undefined)
            }}
          >
            Mark一覧
          </button>
          <button type="button" className="button button-primary" onClick={copyExport}>
            Exportをコピー
          </button>
          <input
            ref={fileInputRef}
            id="open-file"
            type="file"
            accept=".md,.markdown,.mdown,.mkd,text/markdown"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void openFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </header>

      <main className={panelOpen ? 'workspace has-panel' : 'workspace'}>
        <DocumentView
          source={state.doc.source}
          marks={state.marks}
          activeId={activeId}
          onCreate={onCreate}
          onMemo={onMemo}
          onDelete={onDelete}
          scrollRequest={scrollRequest}
        />
        {panelOpen && (
          <MarkPanel
            marks={sorted}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id)
              setScrollRequest({ id, nonce: Date.now() })
            }}
            onMemo={onMemo}
            onDelete={onDelete}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          {toast}
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
