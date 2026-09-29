import { describe, expect, it } from 'vitest'
import { TextIndex } from '../marks/textIndex'
import { renderMarkdown } from './render'

describe('renderMarkdown', () => {
  it('日本語の間の改行はスペースにせず詰め、英単語の間の改行は残す', () => {
    const rendered = renderMarkdown('追加する。\n現状は確認が必要。\nThe quick\nbrown fox\r\n続き\r\nです\n')
    expect(rendered.root.textContent).toBe('追加する。現状は確認が必要。\nThe quick\nbrown fox\r\n続きです')
  })

  it('詰めた後も、テキストと元Markdownの位置が一致する', () => {
    const source = '一行目の文。\n二行目の文。\n'
    const rendered = renderMarkdown(source)
    const index = new TextIndex(rendered.root)
    const point = index.pointAt(index.text.indexOf('二行目'), 'start')!
    const info = rendered.textSources.get(point.node)!
    expect(info.exact).toBe(true)
    expect(source.slice(info.start + point.offset, info.start + point.offset + 3)).toBe('二行目')
  })

  it('コードブロックの改行は残す', () => {
    const rendered = renderMarkdown('```\nあ\nい\n```\n')
    expect(rendered.root.querySelector('pre')!.textContent).toBe('あ\nい\n')
  })
})
