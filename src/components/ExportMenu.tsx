import { useEffect, useRef, useState } from 'react'

interface Props {
  disabled: boolean
  canSaveFile: boolean
  onSave: () => void
  onCopy: () => void
}

/** Exportはボタン1つにまとめ、保存先を小さなメニューで選ぶ（D8・D17） */
export function ExportMenu({ disabled, canSaveFile, onSave, onCopy }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div className="menu-root" ref={rootRef}>
      <button
        type="button"
        className="button button-primary"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        Export
      </button>
      {open && (
        <div className="menu" role="menu">
          {canSaveFile && (
            <button type="button" role="menuitem" className="menu-item" onClick={choose(onSave)}>
              ファイルに保存…
            </button>
          )}
          <button type="button" role="menuitem" className="menu-item" onClick={choose(onCopy)}>
            クリップボードにコピー
          </button>
        </div>
      )}
    </div>
  )
}
