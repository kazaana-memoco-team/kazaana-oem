# Supabase Migration Workflow

このプロジェクトのマイグレーションは **Supabase CLI** で自動適用できます。

## 初回セットアップ（一度だけ）

### 1. Personal Access Token の取得

CLI が Supabase Cloud に接続するための**個人用アクセストークン**を発行します。

👉 https://supabase.com/dashboard/account/tokens

- **Generate new token** をクリック
- 名前は `kazaana-oem-cli` など分かりやすいもの
- 生成された `sbp_...` 形式のトークンをコピー

### 2. シェル環境変数に設定

ターミナルで実行（永続化したい場合は `~/.zshrc` などに追記）：

```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> ⚠ `.env.local` ではなくシェル環境変数です。アプリは使わず CLI だけが見ます。

### 3. プロジェクトをリンク

```bash
npm run db:link
```

→ DB パスワードを聞かれます。
[Supabase Dashboard → Settings → Database](https://supabase.com/dashboard/project/gvwbrdkvdkxvqnuyzpzm/settings/database) →
`Connection string` セクションで `[YOUR-PASSWORD]` の実値を確認 or リセット → 入力。

成功すると `Finished supabase link.` と表示されます。

---

## 通常運用

### 未適用のマイグレーションをすべて適用

```bash
npm run db:push
```

- `supabase/migrations/` 配下の SQL を時系列順に走らせる
- 既に適用済みのものはスキップされる（`schema_migrations` で追跡）
- 当プロジェクトのマイグレーションは **冪等**（`if not exists` / `do $$ exception` を使用）に書いてあるので、過去に手動で実行した SQL があっても安全に再走行できます

### 現在の状態を確認

```bash
npm run db:status
```

ローカルとリモートの差分が見えます。

---

## 新しいマイグレーションを作るとき

ファイル名は `YYYYMMDDHHMMSS_<description>.sql` 形式で `supabase/migrations/` に置くだけ：

```
supabase/migrations/20260428120000_add_something.sql
```

→ `npm run db:push` で反映。

---

## 既存のマイグレーション

- `20260426000001_initial_schema.sql` — 初期スキーマ（profiles, craftsmen, orders, messages, order_events）+ RLS
- `20260426000002_fix_rls_recursion.sql` — RLS 再帰問題の修正
- `20260427000001_admin_chat_model.sql` — 職人のチャット送信ブロック
- `20260427000002_message_sender_context.sql` — チャットの送信コンテキスト
- `20260427000003_message_delete_policy.sql` — メッセージ取り消し
- `20260427000004_documents_table.sql` — 書類テーブル
- `20260427000005_oem_order_number.sql` — OEM連番 + 納品書追加
- `20260427000006_system_settings.sql` — システム設定（メールテンプレ）

---

## トラブルシュート

### `migration repair` が必要と言われた

過去に CLI 外で適用したマイグレーションが `schema_migrations` に記録されていない時に起きます：

```bash
supabase migration repair --status applied <version>
```

`<version>` はファイル名先頭の数字（例：`20260426000001`）。

### ローカル開発DBをリセットしたい

```bash
supabase db reset
```

> ⚠ リモート DB には影響しません（ローカルのDocker DBがあれば、それのみリセット）。

リモートDBのリセットは **絶対実行しないこと**（本番データが消えます）。
