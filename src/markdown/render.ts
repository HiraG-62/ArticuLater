import type { Element as HastElement, Nodes as HastNodes, Properties } from 'hast'
import type { Heading, Root as MdastRoot } from 'mdast'
import { toHast } from 'mdast-util-to-hast'
import { toString } from 'mdast-util-to-string'
import { find, html } from 'property-information'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

/** 描画されたテキストノードが、元Markdownのどこに対応するか */
export interface TextSource {
  /** 元Markdown上の開始オフセット */
  start: number
  /** 元Markdown上の終了オフセット */
  end: number
  /** true のとき、テキストノードの内容が start から1文字ずつ元Markdownと一致する */
  exact: boolean
}

export interface HeadingInfo {
  depth: number
  text: string
  offset: number
}

export interface RenderedDocument {
  root: HTMLElement
  source: string
  headings: HeadingInfo[]
  textSources: WeakMap<Text, TextSource>
  /** 各行の開始オフセット（行番号の計算用） */
  lineStarts: number[]
}

/**
 * Markdownをレンダリングし、描画したテキストノードと元Markdownの位置の対応を記録する。
 * 生のHTMLは描画しない（mdast-util-to-hast の既定動作）。
 */
export function renderMarkdown(source: string, doc: Document = document): RenderedDocument {
  const processor = unified().use(remarkParse).use(remarkGfm)
  const mdast = processor.runSync(processor.parse(source)) as MdastRoot
  const hast = toHast(mdast)

  const root = doc.createElement('article')
  const textSources = new WeakMap<Text, TextSource>()
  appendHast(hast, root, undefined, { doc, source, textSources })

  return {
    root,
    source,
    headings: collectHeadings(mdast),
    textSources,
    lineStarts: computeLineStarts(source),
  }
}

interface BuildContext {
  doc: Document
  source: string
  textSources: WeakMap<Text, TextSource>
}

type Position = { start: number; end: number }

function positionOf(node: HastNodes): Position | undefined {
  const p = node.position
  if (p?.start.offset === undefined || p.end.offset === undefined) return undefined
  return { start: p.start.offset, end: p.end.offset }
}

function appendHast(node: HastNodes, parent: Node, inherited: Position | undefined, ctx: BuildContext) {
  const own = positionOf(node)
  const pos = own ?? inherited

  switch (node.type) {
    case 'root':
      for (const child of node.children) appendHast(child, parent, pos, ctx)
      return
    case 'element': {
      const el = ctx.doc.createElement(node.tagName)
      applyProperties(el, node)
      for (const child of node.children) appendHast(child, el, pos, ctx)
      parent.appendChild(el)
      return
    }
    case 'text': {
      const text = ctx.doc.createTextNode(node.value)
      if (pos) ctx.textSources.set(text, locateText(node.value, pos, ctx.source))
      parent.appendChild(text)
      return
    }
    default:
      // comment / doctype / raw は描画しない
      return
  }
}

/** テキストノードの内容が、元Markdownの範囲内のどこにあるかを特定する */
function locateText(value: string, pos: Position, source: string): TextSource {
  const slice = source.slice(pos.start, pos.end)
  if (slice === value) return { start: pos.start, end: pos.end, exact: true }
  // 空白だけのノード（ブロック間の改行など）は位置を特定しない
  if (value.trim() !== '') {
    // コードブロックの末尾改行、インラインコードのバッククォート、エスケープなどを吸収する
    const needle = value.endsWith('\n') ? value.slice(0, -1) : value
    const index = slice.indexOf(needle)
    if (needle !== '' && index >= 0) {
      const start = pos.start + index
      return { start, end: start + needle.length, exact: true }
    }
  }
  return { start: pos.start, end: pos.end, exact: false }
}

function applyProperties(el: HTMLElement, node: HastElement) {
  const properties: Properties = node.properties ?? {}
  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || value === null || value === false) continue
    const info = find(html, key)
    const attr = info.attribute
    if (value === true) el.setAttribute(attr, '')
    else if (Array.isArray(value)) el.setAttribute(attr, value.join(info.commaSeparated ? ', ' : ' '))
    else el.setAttribute(attr, String(value))
  }
  // チェックボックスは読むだけなので操作させない
  if (node.tagName === 'input') el.setAttribute('disabled', '')
}

function collectHeadings(mdast: MdastRoot): HeadingInfo[] {
  const headings: HeadingInfo[] = []
  const visit = (node: MdastRoot | MdastRoot['children'][number]) => {
    if (node.type === 'heading') {
      const heading = node as Heading
      headings.push({
        depth: heading.depth,
        text: toString(heading),
        offset: heading.position?.start.offset ?? 0,
      })
      return
    }
    if ('children' in node) for (const child of node.children) visit(child as MdastRoot['children'][number])
  }
  visit(mdast)
  return headings
}

function computeLineStarts(source: string): number[] {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return starts
}

/** 元Markdownのオフセットから、1始まりの行番号を求める */
export function lineAt(lineStarts: number[], offset: number): number {
  let lo = 0
  let hi = lineStarts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (lineStarts[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}

/** 元Markdownのオフセットの位置にある見出しの階層を求める */
export function headingPathAt(headings: HeadingInfo[], offset: number): string[] {
  const stack: HeadingInfo[] = []
  for (const heading of headings) {
    if (heading.offset > offset) break
    while (stack.length > 0 && stack[stack.length - 1].depth >= heading.depth) stack.pop()
    stack.push(heading)
  }
  return stack.map((h) => h.text)
}
