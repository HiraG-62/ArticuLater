/** 本文のテキストノードを連結した「描画テキスト」上のオフセットと、DOM上の位置を相互に変換する */
export class TextIndex {
  readonly nodes: Text[] = []
  readonly starts: number[] = []
  readonly text: string

  constructor(readonly root: HTMLElement) {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let offset = 0
    let text = ''
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const t = node as Text
      this.nodes.push(t)
      this.starts.push(offset)
      offset += t.data.length
      text += t.data
    }
    this.text = text
  }

  /** DOM上の位置を描画テキスト上のオフセットに変換する */
  offsetOf(container: Node, offset: number): number {
    const range = this.root.ownerDocument.createRange()
    range.setStart(this.root, 0)
    range.setEnd(container, offset)
    return range.toString().length
  }

  /**
   * 描画テキスト上のオフセットをDOM上の位置に変換する。
   * ノードの境界にあたる場合、開始位置は後ろのノード、終了位置は前のノードを選ぶ。
   */
  pointAt(offset: number, bias: 'start' | 'end'): { node: Text; offset: number } | undefined {
    if (this.nodes.length === 0) return undefined
    for (let i = 0; i < this.nodes.length; i++) {
      const start = this.starts[i]
      const end = start + this.nodes[i].data.length
      const inside = bias === 'start' ? offset >= start && offset < end : offset > start && offset <= end
      if (inside) return { node: this.nodes[i], offset: offset - start }
    }
    const last = this.nodes[this.nodes.length - 1]
    return bias === 'end' && offset >= this.text.length ? { node: last, offset: last.data.length } : undefined
  }

  rangeFor(start: number, end: number): Range | undefined {
    const a = this.pointAt(start, 'start')
    const b = this.pointAt(end, 'end')
    if (!a || !b) return undefined
    const range = this.root.ownerDocument.createRange()
    range.setStart(a.node, a.offset)
    range.setEnd(b.node, b.offset)
    return range
  }
}
