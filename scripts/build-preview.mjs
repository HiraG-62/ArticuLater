// ビルド結果を1つのHTML断片にまとめ、ブラウザでそのまま触れるプレビューを作る。
// 公開先がドキュメントの骨組み（doctype/head/body）を付けるため、ここでは中身だけを出力する。
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const script = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/)
const style = html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/)
if (!script || !style) throw new Error('dist/index.html からスクリプトまたはスタイルを見つけられませんでした')

// 置換文字（U+FFFD）はライブラリの文字列・正規表現中にしか現れないため、エスケープ表記に置き換えて文字化けと区別する
const js = readFileSync(join(dist, script[1]), 'utf8')
  .replaceAll('</script', '<\\/script')
  .replaceAll('\uFFFD', '\\uFFFD')
const css = readFileSync(join(dist, style[1]), 'utf8')

const out = `<title>ArticuLater</title>
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
writeFileSync(join(dist, 'articulater-preview.html'), out)
console.log(`dist/articulater-preview.html (${(out.length / 1024).toFixed(1)} kB)`)
