import { useEffect, useRef } from 'react'
import type { Mark } from '../marks/types'

interface Props {
  mark: Mark
  x: number
  y: number
  onMemo: (memo: string) => void
  onDelete: () => void
  onClose: () => void
}

/** Markをクリックしたときだけ開く、メモと削除の入口（D3） */
export function MarkPopover({ mark, x, y, onMemo, onDelete, onClose }: Props) {
  const memoRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    memoRef.current?.focus()
  }, [mark.id])

  return (
    <div
      className="popover"
      role="dialog"
      aria-label="Mark"
      style={{ left: `max(0px, min(${x - 24}px, calc(100% - 20rem)))`, top: y + 14 }}
    >
      <p className="popover-quote">{mark.quote}</p>
      <label className="visually-hidden" htmlFor={`memo-${mark.id}`}>
        メモ
      </label>
      <textarea
        id={`memo-${mark.id}`}
        ref={memoRef}
        className="memo-input"
        rows={3}
        placeholder="メモ（任意）"
        value={mark.memo}
        onChange={(e) => onMemo(e.target.value)}
      />
      <div className="popover-actions">
        <button type="button" className="button button-danger" onClick={onDelete}>
          削除
        </button>
        <button type="button" className="button" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  )
}
