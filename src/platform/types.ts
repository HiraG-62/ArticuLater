import type { Mark } from '../marks/types'

export interface LoadedDocument {
  /** 文書を識別するパス（Tauriでは絶対パス） */
  path: string
  name: string
  source: string
}

/** アプリ内部に自動保存するReview（D4） */
export interface StoredReview {
  version: 1
  marks: Mark[]
}

/** 実行環境（Tauriまたはブラウザ）ごとに異なる処理 */
export interface Platform {
  /** Exportをファイルに保存できるか */
  canSaveFile: boolean
  /** 起動時に開く文書（コマンドライン引数など。D12） */
  initialDocuments(): Promise<LoadedDocument[]>
  openDialog(): Promise<LoadedDocument[]>
  readDocument(path: string): Promise<LoadedDocument>
  /** ドラッグ＆ドロップや、起動中のアプリへのコマンドライン起動で文書が渡されたとき（D12・D17） */
  onOpenRequest(listener: (docs: LoadedDocument[]) => void): () => void
  /** 文書の外部での変更を監視する（D6） */
  watch(path: string, onChange: () => void): () => void
  loadReview(path: string): Promise<StoredReview | null>
  saveReview(path: string, review: StoredReview): Promise<void>
  copyText(text: string): Promise<void>
  /** Exportをファイルに保存する。キャンセルされたら false（D8） */
  saveExport(documentPath: string, content: string): Promise<boolean>
}

export const MARKDOWN_FILE = /\.(md|markdown|mdown|mkd)$/i

/** `design.md` → `design.review.md`（D15） */
export function exportFileName(documentName: string): string {
  const stem = documentName.replace(MARKDOWN_FILE, '')
  return `${stem}.review.md`
}
