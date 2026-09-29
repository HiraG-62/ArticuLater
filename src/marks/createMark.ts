import { headingPathAt, lineAt, type RenderedDocument } from '../markdown/render'
import type { TextIndex } from './textIndex'
import type { Mark } from './types'

const ANCHOR_LENGTH = 32
const CONTEXT_LIMIT = 60
const BLOCK_SELECTOR = 'p, li, td, th, pre, h1, h2, h3, h4, h5, h6, dt, dd, blockquote'
const SENTENCE_END = /[。．！？!?]|\.(?=\s)/g

/** 選択範囲を本文の範囲内に収め、描画テキスト上の [start, end) を返す。前後の空白は除く */
export function selectionOffsets(range: Range, index: TextIndex): { start: number; end: number } | undefined {
  const docRange = index.root.ownerDocument.createRange()
  docRange.selectNodeContents(index.root)
  const clipped = range.cloneRange()
  if (clipped.compareBoundaryPoints(Range.START_TO_START, docRange) < 0) {
    clipped.setStart(docRange.startContainer, docRange.startOffset)
  }
  if (clipped.compareBoundaryPoints(Range.END_TO_END, docRange) > 0) {
    clipped.setEnd(docRange.endContainer, docRange.endOffset)
  }
  if (clipped.collapsed) return undefined

  let start = index.offsetOf(clipped.startContainer, clipped.startOffset)
  let end = index.offsetOf(clipped.endContainer, clipped.endOffset)
  while (start < end && /\s/.test(index.text[start])) start++
  while (end > start && /\s/.test(index.text[end - 1])) end--
  return start < end ? { start, end } : undefined
}

/** 描画テキスト上の範囲から、Markとして保持する情報を組み立てる */
export function buildMark(
  id: string,
  offsets: { start: number; end: number },
  index: TextIndex,
  rendered: RenderedDocument,
): Mark | undefined {
  const { start, end } = offsets
  const a = index.pointAt(start, 'start')
  const b = index.pointAt(end, 'end')
  if (!a || !b) return undefined

  const sourceStart = sourceOffset(a.node, a.offset, 'start', rendered)
  const sourceEnd = sourceOffset(b.node, b.offset, 'end', rendered)
  const startLine = lineAt(rendered.lineStarts, sourceStart)
  const endLine = Math.max(startLine, lineAt(rendered.lineStarts, Math.max(sourceStart, sourceEnd - 1)))

  const inCode = a.node.parentElement?.closest('pre') != null
  const block = a.node.parentElement?.closest(BLOCK_SELECTOR)
  const endBlock = b.node.parentElement?.closest(BLOCK_SELECTOR)
  const blockStart = block ? index.offsetOf(block, 0) : start
  const blockEnd = endBlock ? index.offsetOf(endBlock, endBlock.childNodes.length) : end

  const before = index.text.slice(blockStart, start)
  const after = index.text.slice(end, blockEnd)

  return {
    id,
    start,
    end,
    quote: index.text.slice(start, end),
    prefix: index.text.slice(Math.max(0, start - ANCHOR_LENGTH), start),
    suffix: index.text.slice(end, end + ANCHOR_LENGTH),
    contextBefore: inCode ? lineBefore(before) : sentenceBefore(before),
    contextAfter: inCode ? lineAfter(after) : sentenceAfter(after),
    headingPath: headingPathAt(rendered.headings, sourceStart),
    startLine,
    endLine,
    inCode,
    memo: '',
    lost: false,
  }
}

function sourceOffset(node: Text, offset: number, bias: 'start' | 'end', rendered: RenderedDocument): number {
  const info = rendered.textSources.get(node)
  if (!info) return 0
  if (info.exact) return Math.min(info.start + offset, info.end)
  return bias === 'start' ? info.start : info.end
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ')
}

function sentenceBefore(text: string): string {
  const flat = normalize(text)
  let cut = 0
  for (const m of flat.matchAll(SENTENCE_END)) cut = m.index + m[0].length
  return limitStart(flat.slice(cut).trimStart())
}

function sentenceAfter(text: string): string {
  const flat = normalize(text)
  SENTENCE_END.lastIndex = 0
  const m = SENTENCE_END.exec(flat)
  return limitEnd((m ? flat.slice(0, m.index + m[0].length) : flat).trimEnd())
}

function lineBefore(text: string): string {
  return limitStart(text.slice(text.lastIndexOf('\n') + 1).trim())
}

function lineAfter(text: string): string {
  const i = text.indexOf('\n')
  return limitEnd((i >= 0 ? text.slice(0, i) : text).trim())
}

function limitStart(text: string): string {
  return text.length > CONTEXT_LIMIT ? '…' + text.slice(text.length - CONTEXT_LIMIT) : text
}

function limitEnd(text: string): string {
  return text.length > CONTEXT_LIMIT ? text.slice(0, CONTEXT_LIMIT) + '…' : text
}

/** 文書内の順序（Exportと一覧の並び。D9・D11） */
export function compareMarks(a: Mark, b: Mark): number {
  return a.start - b.start || a.end - b.end
}
