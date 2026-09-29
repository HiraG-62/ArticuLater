import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { open, save } from '@tauri-apps/plugin-dialog'
import { exportFileName, MARKDOWN_FILE, type LoadedDocument, type Platform, type StoredReview } from './types'

const MARKDOWN_FILTER = { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }

const readDocument = (path: string) => invoke<LoadedDocument>('read_document', { path })

async function readAll(paths: string[]): Promise<LoadedDocument[]> {
  const docs = await Promise.allSettled(paths.filter((p) => MARKDOWN_FILE.test(p)).map(readDocument))
  return docs.filter((r): r is PromiseFulfilledResult<LoadedDocument> => r.status === 'fulfilled').map((r) => r.value)
}

function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return i >= 0 ? path.slice(0, i) : path
}

// 変更の通知は1か所で受け取り、パスごとの購読者に配る
const changeListeners = new Map<string, Set<() => void>>()
let changeSubscription: Promise<unknown> | undefined

export const tauriPlatform: Platform = {
  canSaveFile: true,

  async initialDocuments() {
    return readAll(await invoke<string[]>('get_initial_paths'))
  },

  async openDialog() {
    const selected = await open({ multiple: true, directory: false, filters: [MARKDOWN_FILTER] })
    if (!selected) return []
    return readAll(Array.isArray(selected) ? selected : [selected])
  },

  readDocument,

  onOpenRequest(listener) {
    const offPaths = listen<string[]>('open-paths', async (e) => listener(await readAll(e.payload)))
    const offDrop = getCurrentWebview().onDragDropEvent(async (e) => {
      if (e.payload.type === 'drop') listener(await readAll(e.payload.paths))
    })
    return () => {
      void offPaths.then((off) => off())
      void offDrop.then((off) => off())
    }
  },

  watch(path, onChange) {
    changeSubscription ??= listen<string>('file-changed', (e) => {
      for (const fn of changeListeners.get(e.payload) ?? []) fn()
    })
    const set = changeListeners.get(path) ?? new Set()
    set.add(onChange)
    changeListeners.set(path, set)
    if (set.size === 1) void invoke('watch_file', { path }).catch(() => undefined)
    return () => {
      set.delete(onChange)
      if (set.size === 0) {
        changeListeners.delete(path)
        void invoke('unwatch_file', { path }).catch(() => undefined)
      }
    }
  },

  async loadReview(path) {
    const text = await invoke<string | null>('load_review', { path })
    if (!text) return null
    try {
      const review = JSON.parse(text) as StoredReview
      return review.version === 1 && Array.isArray(review.marks) ? review : null
    } catch {
      return null
    }
  },

  async saveReview(path, review) {
    await invoke('save_review', { path, data: JSON.stringify(review) })
  },

  copyText: (text) => writeText(text),

  async saveExport(documentPath, content) {
    const name = documentPath.slice(dirname(documentPath).length + 1)
    const target = await save({
      defaultPath: `${dirname(documentPath)}\\${exportFileName(name)}`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (!target) return false
    await invoke('write_text', { path: target, content })
    return true
  },
}
