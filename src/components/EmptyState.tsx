interface Props {
  onOpen: () => void
}

/** ファイルを指定せずに起動したときの画面。操作の案内もここだけで行う（D17） */
export function EmptyState({ onOpen }: Props) {
  return (
    <div className="empty">
      <div className="empty-body">
        <h1 className="empty-title">読みながら、気になった箇所をMarkする</h1>
        <p className="empty-lead">Markdownファイルを開くか、このウィンドウにドロップしてください。</p>
        <button type="button" className="button button-primary empty-open" title="開く（Ctrl+O）" onClick={onOpen}>
          ファイルを開く
        </button>
        <dl className="guide">
          <div className="guide-row">
            <dt>テキストを選択</dt>
            <dd>その場でMarkになります。理由を書く必要はありません</dd>
          </div>
          <div className="guide-row">
            <dt>Markをクリック</dt>
            <dd>メモを書く・削除する</dd>
          </div>
          <div className="guide-row">
            <dt>
              <kbd>Ctrl</kbd>＋ドラッグ
            </dt>
            <dd>Markにならない通常の選択</dd>
          </div>
          <div className="guide-row">
            <dt>
              <kbd>Ctrl</kbd>＋<kbd>Z</kbd>
            </dt>
            <dd>直前の操作を取り消す</dd>
          </div>
          <div className="guide-row">
            <dt>Export</dt>
            <dd>読み終えたら、Markを普段使っているAIに渡して一件ずつ言語化する</dd>
          </div>
        </dl>
        <dl className="guide guide-keys">
          <div className="guide-row">
            <dt>
              <kbd>M</kbd>
            </dt>
            <dd>直前のMarkにメモを書く</dd>
          </div>
          <div className="guide-row">
            <dt>
              <kbd>F8</kbd> / <kbd>Shift</kbd>＋<kbd>F8</kbd>
            </dt>
            <dd>次／前のMarkへ移動</dd>
          </div>
          <div className="guide-row">
            <dt>
              <kbd>Ctrl</kbd>＋<kbd>B</kbd>
            </dt>
            <dd>Mark一覧を開く・閉じる</dd>
          </div>
          <div className="guide-row">
            <dt>
              <kbd>Ctrl</kbd>＋<kbd>Shift</kbd>＋<kbd>C</kbd>
            </dt>
            <dd>Exportをクリップボードにコピー</dd>
          </div>
          <div className="guide-row">
            <dt>
              <kbd>Ctrl</kbd>＋<kbd>O</kbd>
            </dt>
            <dd>ファイルを開く</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
