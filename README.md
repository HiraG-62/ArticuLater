# ArticuLater

> **Mark now. Articulate later.**

Markdownドキュメントを読みながら、気になった箇所をテキスト選択だけでMarkし、後からAIとの対話で言語化するためのデスクトップアプリ。

- プロダクト仕様: [docs/PRODUCT.md](docs/PRODUCT.md)
- 設計決定ログ: [docs/DECISIONS.md](docs/DECISIONS.md)

## 開発

現在は、D1（選択＝即Mark）を検証するためのプロトタイプ段階で、ブラウザで動くフロントエンドのみを実装している。Tauriへの組み込みは検証後に行う。

```sh
npm install
npm run dev            # 開発サーバー
npm test               # 単体テスト
npm run typecheck      # 型チェック
npm run build:preview  # 1ファイルのプレビュー（dist/articulater-preview.html）を作る
```
