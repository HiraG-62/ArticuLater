import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../markdown/render'
import { reanchor } from './anchor'
import { buildMark } from './createMark'
import { TextIndex } from './textIndex'

function markIn(source: string, quote: string, occurrence = 0) {
  const rendered = renderMarkdown(source)
  const index = new TextIndex(rendered.root)
  let at = -1
  for (let i = 0; i <= occurrence; i++) at = index.text.indexOf(quote, at + 1)
  return { ...buildMark('m1', { start: at, end: at + quote.length }, index, rendered)!, memo: 'メモ' }
}

describe('reanchor', () => {
  const before = '# 設計\n\n## A\n\n通知は再試行する。\n\n## B\n\nメールも再試行する。\n'

  it('文書が変わっても、前後の文脈で同じ箇所を見つける', () => {
    const mark = markIn(before, '再試行', 1)
    const after = '# 設計\n\n## 追加された節\n\n新しい段落。\n\n## A\n\n通知は再試行する。\n\n## B\n\nメールも再試行する。\n'
    const [found] = reanchor([mark], after)
    expect(found.lost).toBe(false)
    expect(found.headingPath).toEqual(['設計', 'B'])
    expect(found.startLine).toBe(13)
    expect(found.memo).toBe('メモ')
  })

  it('引用が見つからなければ、記録時の情報を残して位置不明にする', () => {
    const mark = markIn(before, 'メールも')
    const [lost] = reanchor([mark], '# 設計\n\n別の内容。\n')
    expect(lost.lost).toBe(true)
    expect(lost.quote).toBe('メールも')
    expect(lost.startLine).toBe(mark.startLine)
    expect(lost.memo).toBe('メモ')
  })

  it('位置不明だったMarkも、引用が戻れば見つかる', () => {
    const mark = { ...markIn(before, 'メールも'), lost: true }
    const [found] = reanchor([mark], before)
    expect(found.lost).toBe(false)
  })
})
