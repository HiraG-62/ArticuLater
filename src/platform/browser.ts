import sample from '../sample/sample.md?raw'
import { MARKDOWN_FILE, type LoadedDocument, type Platform, type StoredReview } from './types'

// ブラウザで動かす場合（開発時・プレビュー）の実装。ファイルの保存と変更監視はできない

const STORAGE_PREFIX = 'articulater:review:'

async function readFiles(files: FileList | File[]): Promise<LoadedDocument[]> {
  const markdown = Array.from(files).filter((f) => MARKDOWN_FILE.test(f.name))
  return Promise.all(markdown.map(async (f) => ({ path: f.name, name: f.name, source: await f.text() })))
}

export const browserPlatform: Platform = {
  canSaveFile: false,

  async initialDocuments() {
    return [{ path: 'sample-design.md', name: 'sample-design.md', source: sample }]
  },

  openDialog() {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = '.md,.markdown,.mdown,.mkd,text/markdown'
      input.addEventListener('change', () => resolve(input.files ? readFiles(input.files) : []))
      input.addEventListener('cancel', () => resolve([]))
      input.click()
    })
  },

  async readDocument(path) {
    if (path === 'sample-design.md') return { path, name: path, source: sample }
    throw new Error('ブラウザでは、開いたファイルを読み直せません')
  },

  onOpenRequest(listener) {
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return
      e.preventDefault()
      listener(await readFiles(e.dataTransfer.files))
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  },

  watch() {
    return () => undefined
  },

  async loadReview(path) {
    try {
      const text = localStorage.getItem(STORAGE_PREFIX + path)
      const review = text ? (JSON.parse(text) as StoredReview) : null
      return review?.version === 1 && Array.isArray(review.marks) ? review : null
    } catch {
      return null
    }
  },

  async saveReview(path, review) {
    try {
      localStorage.setItem(STORAGE_PREFIX + path, JSON.stringify(review))
    } catch {
      // 保存できない環境（プライベートウィンドウなど）では、保存せずに続ける
    }
  },

  copyText: (text) => navigator.clipboard.writeText(text),

  async saveExport() {
    return false
  },
}
