# kazaana-oem

BECOS（thebecos.com）の OEM 発注プラットフォーム。本体 Shopify には手を入れず、サブドメイン（例：`oem.thebecos.com`）で独立運用する Next.js アプリ。

## スタック

- Next.js 16（App Router、TypeScript、Tailwind v4、shadcn/ui）
- Supabase（Postgres + Auth + Storage + Realtime）
- Shopify Admin API GraphQL（Custom App、Draft Order経由でCheckoutへ）
- Vercel ホスティング想定

## セットアップ手順

### 1. 依存インストール

```bash
npm install
```

### 2. Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) で新規プロジェクトを作成
2. Settings → API から URL・publishable key・secret key を取得
3. `.env.local.example` を `.env.local` にコピーして埋める
4. SQL Editor で `supabase/migrations/20260426000001_initial_schema.sql` を実行
   - もしくは Supabase CLI を使う場合：
     ```bash
     npx supabase link --project-ref <YOUR_PROJECT_REF>
     npx supabase db push
     ```

### 3. Shopify Custom App 作成

thebecos.com の Shopify Admin で：

1. Settings → Apps and sales channels → Develop apps → Create an app
2. **Admin API scopes**：
   - `read_products`, `read_inventory`
   - `write_draft_orders`, `read_draft_orders`
   - `read_orders`
3. Install app → Admin API access token を取得（`shpat_...`）
4. `SHOPIFY_ADMIN_API_TOKEN` に設定

### 4. Shopify Webhook 設定

本番デプロイ後（または ngrok でローカル検証時）：

- Shopify Admin → Settings → Notifications → Webhooks
- Event: `Order paid` / `Order created`
- Format: JSON
- URL: `https://oem.thebecos.com/api/shopify/webhook`
- 表示される Webhook signing secret を `SHOPIFY_WEBHOOK_SECRET` に設定

### 5. ローカル開発

```bash
npm run dev
```

http://localhost:3000 で起動。

## ディレクトリ構成

```
app/
  (auth)/             — login / signup
  account/            — マイページ
  api/shopify/webhook — Shopify Webhook受信
  actions/            — Server Actions（auth など）
  page.tsx            — ランディング
components/
  ui/                 — shadcn/ui
  customizer/         — カスタマイズUI（Phase 1で実装）
  chat/               — チャットUI（Phase 2で実装）
  order/              — 注文表示
lib/
  supabase/           — Supabase クライアント（client / server / proxy）
  shopify/            — Shopify Admin API クライアント
  types/database.ts   — DBの型（後で gen types で自動生成可能）
proxy.ts              — Next.js 16 Proxy（旧 middleware）— 認証ガード
supabase/migrations/  — DBスキーマ
```

## 開発フェーズ

- **Phase 0**：基盤・認証・サブドメインDNS（**このスキャフォールドが該当**）
- **Phase 1**：商品取得・カスタマイズUI・注文DB保存
- **Phase 2**：Draft Order 作成・Webhook 受信・チャット
- **Phase 3**：管理画面（注文一覧・職人割当）
- **Phase 4**：完全カスタムオーダー（B）

## デプロイ（Vercel）

1. Vercel に新規プロジェクトを作成し、このリポジトリを連携
2. 環境変数を Vercel に設定（`.env.local` と同じ値）
3. Domains → `oem.thebecos.com` を追加し、表示される DNS（CNAME）をドメイン側に設定
