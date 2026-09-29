import type { Mark } from '../marks/types'

/** AIへの指示（D15で確定した文面） */
const INSTRUCTIONS = `## AIへの指示

このファイルは、ユーザーが上記の文書を読みながら、気になった箇所をMarkしたものです。
Markは「問題点」を意味しません。ユーザーの思考がその箇所に反応した、という事実だけを表します。
その反応は、疑問・違和感・アイデア・興味・後でもう一度見たい、などさまざまです。
Markした理由は、まだ言語化されていないことがあります。

あなたの役割は、ユーザーが自分の考えを言語化するのを手伝うことです。
次の手順に従い、日本語で対話してください。

1. まず対象文書を読み、全体を把握してください。
2. Markを番号順に一件ずつ扱ってください。複数のMarkをまとめて扱わないでください。
3. 各Markでは、まず位置と引用を示してから、ユーザーに問いかけてください。
   - メモがない場合：意図を推測せず、「この箇所で、何が気になりましたか？」のような開かれた質問から始めてください。
     ユーザーが言葉にしづらそうなときに限り、「疑問」「違和感」「改善案」「アイデア」「あとで確認したいこと」などの観点を例として示してください。どれかを選ばせるためのものではありません。
   - メモがある場合：メモを出発点に、考えを深める質問をしてください。メモの意味を推測で補わないでください。
4. ユーザーの反応を、問題・疑問・アイデアなどと決めつけないでください。
   あなたの意見や改善案は、ユーザーが求めたとき、またはユーザーの考えが言語化された後に示してください。
5. ユーザーが「特にない」「保留」「スキップ」と答えたら、そのまま次のMarkへ進んでください。
6. 対話の途中では、文書を修正しないでください。
7. すべてのMarkを扱い終えたら、各Markについて「ユーザーが言語化した内容」と「結論（例：修正する／さらに検討する／対応不要／保留）」を、会話の中で一覧にしてください。
8. その一覧をもとに修正方針を示し、ユーザーの承認を得てから文書を修正してください。

各Markの結論の確認や修正方針の承認など、ユーザーに選んでもらう・承認してもらう場面では、ユーザーに質問するための専用のツール（例：Claude Code の AskUserQuestion）が使える場合は、それを使ってください。
「この箇所で、何が気になりましたか？」のような開かれた質問には使わず、通常のメッセージで尋ねてください。`

const LOST_NOTE = `以下のMarkは、現在の文書では該当箇所が見つかりませんでした。Mark後に文書が変更された可能性があります。
引用をもとに現在の文書で該当しそうな箇所を探し、見つかった場合も、ユーザーに確認してから扱ってください。`

/** Review情報をExport用のMarkdownに変換する（D7・D9・D15） */
export function exportReview(documentPath: string, marks: Mark[]): string {
  const found = marks.filter((m) => !m.lost)
  const lost = marks.filter((m) => m.lost)
  const count = lost.length > 0 ? `${marks.length}（うち位置不明 ${lost.length}）` : `${marks.length}`

  const parts = [
    '# ArticuLater Review',
    `- 対象文書: ${documentPath}\n- Mark数: ${count}`,
    INSTRUCTIONS,
    '## Marks',
  ]
  let n = 0
  for (const mark of found) parts.push(markSection(++n, mark, '位置'))
  if (lost.length > 0) {
    parts.push('## 位置不明のMark', LOST_NOTE)
    for (const mark of lost) parts.push(markSection(++n, mark, '記録時の位置'))
  }
  return parts.join('\n\n') + '\n'
}

function markSection(n: number, mark: Mark, positionLabel: string): string {
  const lines = mark.startLine === mark.endLine ? `L${mark.startLine}` : `L${mark.startLine}-L${mark.endLine}`
  const where = mark.headingPath.length > 0 ? `${mark.headingPath.join(' > ')}（${lines}）` : lines
  return [
    `### Mark ${n}`,
    `- ${positionLabel}: ${where}`,
    `- 引用:\n${quoteBlock(mark)}`,
    `- 前の文脈: ${context(mark.contextBefore)}`,
    `- 後の文脈: ${context(mark.contextAfter)}`,
    `- メモ: ${memo(mark.memo)}`,
  ].join('\n')
}

function quoteBlock(mark: Mark): string {
  if (mark.inCode) {
    const longest = Math.max(2, ...Array.from(mark.quote.matchAll(/`+/g), (m) => m[0].length))
    const fence = '`'.repeat(longest + 1)
    return indent([fence, mark.quote, fence].join('\n'))
  }
  return indent(mark.quote.split('\n').map((line) => (line === '' ? '>' : `> ${line}`)).join('\n'))
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')
}

function context(text: string): string {
  return text === '' ? 'なし' : `「${text}」`
}

function memo(text: string): string {
  const trimmed = text.trim()
  if (trimmed === '') return 'なし'
  return trimmed.split('\n').join('\n  ')
}
