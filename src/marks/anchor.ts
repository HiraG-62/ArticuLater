import { renderMarkdown, type RenderedDocument } from '../markdown/render'
import { buildMark } from './createMark'
import { TextIndex } from './textIndex'
import type { Mark } from './types'

/**
 * 保存しておいたMarkを、現在の文書の中で探し直す（D5・D6）。
 * 引用テキストの出現箇所のうち、前後の文脈が最もよく一致する位置を選ぶ。
 * 見つからなければ、記録時の情報を残したまま「位置不明」にする。
 */
export function reanchor(marks: Mark[], source: string): Mark[] {
  const rendered = renderMarkdown(source)
  const index = new TextIndex(rendered.root)
  return marks.map((mark) => reanchorOne(mark, index, rendered))
}

function reanchorOne(mark: Mark, index: TextIndex, rendered: RenderedDocument): Mark {
  const text = index.text
  let best: { at: number; score: number; distance: number } | undefined
  for (let at = text.indexOf(mark.quote); at >= 0 && mark.quote !== ''; at = text.indexOf(mark.quote, at + 1)) {
    const score =
      commonSuffix(text.slice(Math.max(0, at - mark.prefix.length), at), mark.prefix) +
      commonPrefix(text.slice(at + mark.quote.length, at + mark.quote.length + mark.suffix.length), mark.suffix)
    const distance = Math.abs(at - mark.start)
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = { at, score, distance }
    }
  }
  if (!best) return { ...mark, lost: true }

  const found = buildMark(mark.id, { start: best.at, end: best.at + mark.quote.length }, index, rendered)
  return found ? { ...found, memo: mark.memo } : { ...mark, lost: true }
}

function commonPrefix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

function commonSuffix(a: string, b: string): number {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}
