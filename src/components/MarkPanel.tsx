import type { Mark } from '../marks/types'

interface Props {
  marks: Mark[]
  activeId: string | undefined
  onSelect: (id: string) => void
  onMemo: (id: string, memo: string) => void
  onDelete: (id: string) => void
}

/** Mark一覧（D11）。並びは文書順で、位置不明のMarkは分けて表示する */
export function MarkPanel({ marks, activeId, onSelect, onMemo, onDelete }: Props) {
  const found = marks.filter((m) => !m.lost)
  const lost = marks.filter((m) => m.lost)

  return (
    <aside className="panel" aria-label="Mark一覧">
      <h2 className="panel-title">Mark一覧</h2>
      {marks.length === 0 ? (
        <p className="panel-empty">本文のテキストを選択すると、ここに並びます。</p>
      ) : (
        <ol className="mark-list">
          {found.map((mark) => (
            <MarkItem key={mark.id} mark={mark} active={mark.id === activeId} {...{ onSelect, onMemo, onDelete }} />
          ))}
        </ol>
      )}
      {lost.length > 0 && (
        <>
          <h3 className="panel-subtitle">位置不明</h3>
          <ol className="mark-list">
            {lost.map((mark) => (
              <MarkItem key={mark.id} mark={mark} active={false} {...{ onSelect, onMemo, onDelete }} />
            ))}
          </ol>
        </>
      )}
    </aside>
  )
}

function MarkItem({
  mark,
  active,
  onSelect,
  onMemo,
  onDelete,
}: { mark: Mark; active: boolean } & Omit<Props, 'marks' | 'activeId'>) {
  const lines = mark.startLine === mark.endLine ? `L${mark.startLine}` : `L${mark.startLine}–${mark.endLine}`
  return (
    <li className={active ? 'mark-item is-active' : 'mark-item'}>
      <button type="button" className="mark-jump" onClick={() => onSelect(mark.id)} disabled={mark.lost}>
        <span className={mark.inCode ? 'mark-quote is-code' : 'mark-quote'}>{mark.quote}</span>
        <span className="mark-meta">
          {mark.headingPath.length > 0 && <span>{mark.headingPath[mark.headingPath.length - 1]}</span>}
          <span className="mark-lines">{lines}</span>
        </span>
      </button>
      <label className="visually-hidden" htmlFor={`panel-memo-${mark.id}`}>
        メモ
      </label>
      <textarea
        id={`panel-memo-${mark.id}`}
        className="memo-input is-compact"
        rows={1}
        placeholder="メモ（任意）"
        value={mark.memo}
        onChange={(e) => onMemo(mark.id, e.target.value)}
      />
      <button type="button" className="link-button" onClick={() => onDelete(mark.id)}>
        削除
      </button>
    </li>
  )
}
