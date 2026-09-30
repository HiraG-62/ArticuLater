import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled: boolean
  canSaveFile: boolean
  onSave: () => void
  onCopy: () => void
}

/** Exportはボタン1つにまとめ、保存先を小さなメニューで選ぶ（D8・D17）。Ctrl+E でも開く（D20） */
export function ExportMenu({ open, onOpenChange, disabled, canSaveFile, onSave, onCopy }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // キーボードで開いた場合も、そのまま矢印キーやEnterで選べるようにする
    menuRef.current?.querySelector<HTMLButtonElement>('.menu-item')?.focus()
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])
        const i = items.indexOf(document.activeElement as HTMLButtonElement)
        const next = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]
        next?.focus()
        e.preventDefault()
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  const choose = (action: () => void) => () => {
    onOpenChange(false)
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
        title="Export（Ctrl+E）"
        onClick={() => onOpenChange(!open)}
      >
        Export
      </button>
      {open && (
        <div className="menu" role="menu" ref={menuRef}>
          {canSaveFile && (
            <button type="button" role="menuitem" className="menu-item" onClick={choose(onSave)}>
              ファイルに保存…
            </button>
          )}
          <button type="button" role="menuitem" className="menu-item" onClick={choose(onCopy)}>
            クリップボードにコピー
            <kbd className="menu-key">Ctrl+Shift+C</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
