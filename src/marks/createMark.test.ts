import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../markdown/render'
import { buildMark, selectionOffsets } from './createMark'
import { overlapSpans } from './highlight'
import { TextIndex } from './textIndex'

const source = `# 設計書

## データモデル

通知は単一テーブルで管理する。初期段階では**全データ**を単一テーブルで管理することで、マイグレーションを不要にする。次の文。

| カラム | 型 |
| --- | --- |
| user_id | UUID |

\`\`\`mermaid
flowchart LR
  A --> B
  B --> C
\`\`\`

- 項目1 \`inline\` です
`

function setup() {
  const rendered = renderMarkdown(source)
  document.body.replaceChildren(rendered.root)
  const index = new TextIndex(rendered.root)
  return { rendered, index }
}

function markOf(text: string, occurrence = 0) {
  const { rendered, index } = setup()
  let at = -1
  for (let i = 0; i <= occurrence; i++) at = index.text.indexOf(text, at + 1)
  expect(at).toBeGreaterThanOrEqual(0)
  const mark = buildMark('m1', { start: at, end: at + text.length }, index, rendered)
  expect(mark).toBeDefined()
  return mark!
}

describe('buildMark', () => {
  it('段落内の選択を行番号・見出し・文単位の文脈に対応付ける', () => {
    const mark = markOf('全データを単一テーブル')
    expect(mark.quote).toBe('全データを単一テーブル')
    expect(mark.startLine).toBe(5)
    expect(mark.endLine).toBe(5)
    expect(mark.headingPath).toEqual(['設計書', 'データモデル'])
    expect(mark.contextBefore).toBe('初期段階では')
    expect(mark.contextAfter).toBe('で管理することで、マイグレーションを不要にする。')
    expect(mark.inCode).toBe(false)
  })

  it('表のセルを行番号に対応付ける', () => {
    const mark = markOf('user_id')
    expect(mark.startLine).toBe(9)
  })

  it('Mermaidのコードブロック内の選択を行単位で対応付ける', () => {
    const mark = markOf('B --> C')
    expect(mark.inCode).toBe(true)
    expect(mark.startLine).toBe(14)
    expect(mark.endLine).toBe(14)
    expect(mark.contextBefore).toBe('')
    expect(mark.contextAfter).toBe('')
  })

  it('複数行にまたがるコードの選択は行範囲になる', () => {
    const mark = markOf('A --> B\n  B --> C')
    expect(mark.startLine).toBe(13)
    expect(mark.endLine).toBe(14)
  })

  it('インラインコードの中も位置を特定できる', () => {
    const mark = markOf('inline')
    expect(mark.startLine).toBe(17)
  })
})

describe('selectionOffsets', () => {
  it('前後の空白を除き、本文の外にはみ出した範囲を収める', () => {
    const { index } = setup()
    const range = document.createRange()
    range.setStart(document.body, 0)
    const target = index.text.indexOf('データモデル')
    const point = index.pointAt(target + 'データモデル'.length, 'end')!
    range.setEnd(point.node, point.offset)
    const offsets = selectionOffsets(range, index)!
    expect(index.text.slice(offsets.start, offsets.end)).toBe('設計書\nデータモデル')
  })

  it('空白だけの選択はMarkにしない', () => {
    const { index } = setup()
    const at = index.text.indexOf('\n')
    const range = index.rangeFor(at, at + 1)!
    expect(selectionOffsets(range, index)).toBeUndefined()
  })
})

describe('overlapSpans', () => {
  it('重なった区間だけを返す', () => {
    expect(overlapSpans([{ start: 0, end: 10 }, { start: 5, end: 15 }, { start: 20, end: 25 }])).toEqual([
      { start: 5, end: 10 },
    ])
  })
})
