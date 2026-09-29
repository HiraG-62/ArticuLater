# ArticuLater

> **Mark now. Articulate later.**

Markdownドキュメントを読みながら、気になった箇所をテキスト選択だけでMarkし、後からAIとの対話で言語化するためのデスクトップアプリ。

- プロダクト仕様: [docs/PRODUCT.md](docs/PRODUCT.md)
- 設計決定ログ: [docs/DECISIONS.md](docs/DECISIONS.md)

## 試す（Windows）

GitHub Actions の「Windows build」ワークフローが、push のたびにインストーラを作る。
実行結果のページにある成果物「ArticuLater-windows」をダウンロードし、中の `.exe`（または `.msi`）でインストールする。
未署名のため、初回の実行時に SmartScreen の警告が出る（「詳細情報」→「実行」で起動できる）。

インストール後は、コマンドラインから文書を指定して開ける。

```sh
articulater docs/design.md
```

## 開発

デスクトップアプリは Tauri v2、画面は React ＋ TypeScript で作っている。

```sh
npm install
npm run tauri dev      # デスクトップアプリとして起動（Rust と WebView2 が必要）
npm run dev            # 画面だけをブラウザで起動（サンプル文書が開く）
npm test               # 単体テスト
npm run typecheck      # 型チェック
npm run build:preview  # ブラウザで触れる1ファイルのプレビュー（dist/articulater-preview.html）
```
