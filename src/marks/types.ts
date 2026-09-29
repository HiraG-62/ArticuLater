export interface Mark {
  id: string
  /** 描画テキスト上の開始オフセット（ハイライト用） */
  start: number
  /** 描画テキスト上の終了オフセット（ハイライト用） */
  end: number
  /** 選択されたテキスト */
  quote: string
  /** 再アンカー用の直前のテキスト（D5） */
  prefix: string
  /** 再アンカー用の直後のテキスト（D5） */
  suffix: string
  /** Export用の前の文脈（引用を含む文の範囲。D15） */
  contextBefore: string
  /** Export用の後の文脈（引用を含む文の範囲。D15） */
  contextAfter: string
  headingPath: string[]
  startLine: number
  endLine: number
  /** コードブロック内から選択されたか（引用の表記に使う。D15） */
  inCode: boolean
  memo: string
  /** 現在の文書で位置を特定できないか（D6） */
  lost: boolean
}
