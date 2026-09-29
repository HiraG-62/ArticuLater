import { describe, expect, it } from 'vitest'
import type { Mark } from '../marks/types'
import { exportReview } from './exportReview'

const base: Omit<Mark, 'id' | 'quote'> = {
  start: 0,
  end: 0,
  prefix: '',
  suffix: '',
  contextBefore: '',
  contextAfter: '',
  headingPath: [],
  startLine: 1,
  endLine: 1,
  inCode: false,
  memo: '',
  lost: false,
}

describe('exportReview', () => {
  it('D15のテンプレートどおりに出力する', () => {
    const marks: Mark[] = [
      {
        ...base,
        id: 'a',
        quote: '全データを単一テーブルで管理する',
        headingPath: ['設計', 'データモデル'],
        startLine: 42,
        endLine: 43,
        contextBefore: 'スキーマ設計を単純にするため、初期段階では',
        contextAfter: 'ことで、マイグレーションを不要にする。',
      },
      { ...base, id: 'b', quote: 'A --> B\nB --> C', inCode: true, startLine: 120, endLine: 121, memo: '本当にこの順序？' },
      { ...base, id: 'c', quote: 'MVPは2週間で完成させる', headingPath: ['概要'], startLine: 5, endLine: 5, lost: true },
    ]
    const text = exportReview('C:\\Users\\you\\project\\docs\\design.md', marks)
    expect(text).toContain('- 対象文書: C:\\Users\\you\\project\\docs\\design.md\n- Mark数: 3（うち位置不明 1）')
    expect(text).toContain(
      [
        '### Mark 1',
        '- 位置: 設計 > データモデル（L42-L43）',
        '- 引用:',
        '  > 全データを単一テーブルで管理する',
        '- 前の文脈: 「スキーマ設計を単純にするため、初期段階では」',
        '- 後の文脈: 「ことで、マイグレーションを不要にする。」',
        '- メモ: なし',
      ].join('\n'),
    )
    expect(text).toContain(
      ['### Mark 2', '- 位置: L120-L121', '- 引用:', '  ```', '  A --> B', '  B --> C', '  ```', '- 前の文脈: なし'].join('\n'),
    )
    expect(text).toContain('- メモ: 本当にこの順序？')
    expect(text).toContain('（例：Claude Code の AskUserQuestion）が使える場合は、それを使ってください。')
    expect(text).toContain('## 位置不明のMark')
    expect(text).toContain('### Mark 3\n- 記録時の位置: 概要（L5）')
    expect(text.indexOf('## 位置不明のMark')).toBeLessThan(text.indexOf('### Mark 3'))
  })

  it('引用にバッククォートの連続があれば、より長いフェンスで囲む', () => {
    const text = exportReview('x.md', [{ ...base, id: 'a', quote: '```js\nx\n```', inCode: true }])
    expect(text).toContain('  ````\n  ```js')
  })

  it('位置不明がなければ件数だけを書き、位置不明の節を出さない', () => {
    const text = exportReview('x.md', [{ ...base, id: 'a', quote: 'q' }])
    expect(text).toContain('- Mark数: 1\n')
    expect(text).not.toContain('## 位置不明のMark')
  })
})
