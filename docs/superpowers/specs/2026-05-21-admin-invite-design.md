# 新規管理者の招待 — 設計書

- 日付: 2026-05-21
- 対象: 管理画面サイドバーから新しい管理者をメール招待で登録する機能

## 目的 / スコープ

既存の管理者が、管理画面から新しい管理者を **メール招待** で登録できるようにする。
招待された本人がリンクからパスワードを自分で設定して `role='admin'` として参加する。

含むもの:
- サイドバーの新規リンク「管理者」
- 招待フォーム（メール必須／表示名 任意）
- 現管理者・招待中（未承諾）の一覧表示
- 招待受諾フロー（リンク検証 → パスワード設定）

含まないもの（今回スコープ外 / 将来の検討）:
- 管理者権限の剥奪、招待の取り消し
- 招待の再送ボタン（※成功画面のリンク表示で手動再送は代替可能）
- 既存ユーザーの「昇格」機能

## 前提（既存コードの確認結果）

- 管理者の判定は `profiles.role === 'admin'`。`UserRole = 'customer' | 'craftsman' | 'admin'`。
- 新規 auth ユーザー作成時、トリガー `handle_new_user` が `profiles` を **role 既定値 `customer`** で自動作成する。
- `lib/supabase/server.ts` に `createServiceRoleClient()`（`SUPABASE_SECRET_KEY`）が既にあり、`auth.admin.*` と RLS バイパスが可能。
- メール送信は Resend ベース（`lib/email/send.ts`、`RESEND_API_KEY` 未設定時は no-op）。
- 既存の Supabase 認証コールバック／パスワード設定フローは **無い**（Shopify OAuth のみ）。新設が必要。
- `proxy.ts` で role 制限される prefix は `/account`・`/craftsman`・`/admin` のみ。`/auth/*` は対象外＝未ログインでも到達可能。

## 採用方式

**招待メールは `auth.admin.generateLink({ type: 'invite' })` で生成し、本文は既存の Resend で自前送信する（A案）。**

- 理由: プロジェクトが全面的に Resend を使用しており、ブランド統一・文面のコード管理・Supabase 側 SMTP 設定不要という利点がある。
- 不採用: `inviteUserByEmail`（B案）は本番で Supabase Auth の SMTP 設定が必須になり、文面がリポジトリ外になるため方針とズレる。
- 補強: 招待アクションの成功時に **招待リンク本体も画面に表示（コピー可能）** する。RESEND 未設定の開発環境やメール配信失敗時のフォールバックになる。

## アーキテクチャ / コンポーネント

### 1. 画面・ルーティング
- `app/admin/layout.tsx`: サイドバーに `<AdminSidebarLink href="/admin/admins">管理者</AdminSidebarLink>` を追加。
- `app/admin/admins/page.tsx`（サーバーコンポーネント, `dynamic = "force-dynamic"`）: 招待フォーム＋一覧をレンダリング。
- `app/admin/admins/invite-admin-form.tsx`（クライアント, `useActionState`）: 入力フォーム＋成功時の招待リンク表示。
- `app/admin/admins/actions.ts`: サーバーアクション `inviteAdmin`。

### 2. 招待処理 `inviteAdmin(formData)`
1. **管理者の再検証**: サーバーアクションは layout のガードを通らないため、先頭で `getCurrentUserWithRole()` を呼び `role === 'admin'` を確認。違えばエラー返却。
2. zod 検証: `email`（必須・email 形式）、`display_name`（任意・最大80字）。
3. `createServiceRoleClient()` で `auth.admin.generateLink({ type: 'invite', email, options: { data: { display_name } } })` を実行。ユーザー作成＋`properties.hashed_token` を取得。
4. 作成されたユーザーの `profiles.role` を `'admin'` に更新（service-role で RLS バイパス）。
5. 招待 URL を組み立て: `${NEXT_PUBLIC_SITE_URL}/auth/confirm?token_hash=<hashed_token>&type=invite&next=/auth/set-password`。
6. Resend で招待メール送信（ブランド日本語文面）。
7. 戻り値: `{ ok: true, inviteUrl }` または `{ error }`。
8. 既存メールアドレスは `generateLink` がエラー → 「既に登録済みです」を返す。

### 3. 受諾フロー
- `app/auth/confirm/route.ts`（GET）: クエリ `token_hash`・`type`・`next` を読み、anon サーバークライアントで `verifyOtp({ type: 'invite', token_hash })`。成功でセッション cookie が確立 → `next` へリダイレクト。失敗時はエラー表示（`/login?error=...` へ）。
- `app/auth/set-password/page.tsx` + `app/auth/set-password/actions.ts`:
  - ページ: `getUser()` でセッション確認、無ければ `/login` へ。
  - フォーム: パスワード（8字以上）＋確認（一致）。`supabase.auth.updateUser({ password })` 実行 → `/admin` へリダイレクト。
- `proxy.ts` は変更不要（`/auth/*` は保護対象外）。

### 4. 一覧表示
- `page.tsx` 内で service-role クライアントを使用:
  - `profiles` を `role='admin'` で取得。
  - 各 id を `auth.admin.getUserById(id)` で email・確認状態を取得（`lib/email/notify.ts` の `lookupEmails` と同方式。小規模運用なので件数は少なく十分）。
- 表示カラム: 表示名 / メール / ステータス（**有効** または **招待中** ＝ `email_confirmed_at` が null）/ 作成・招待日時。

### 5. メール文面
- `lib/email/invite.ts` に `sendAdminInvite({ to, inviteUrl, displayName? })` を追加し `sendEmail` を呼ぶ（`notify.ts` のスタイルに合わせる）。
- 件名例: 「【BECOS OEM】管理者アカウントへの招待」。本文に招待リンクと有効期限の注意書き。

## セキュリティ / 運用

- service-role クライアントは **admin 検証後のサーバー側でのみ** 使用する。
- `inviteAdmin` の admin 再検証が最重要（サーバーアクションは直接呼び出し可能なため）。
- `set-password` アクションは有効なセッション必須（`updateUser` はセッションユーザー本人のみ更新）。
- 必要 env: `SUPABASE_SECRET_KEY`（既存）, `RESEND_API_KEY` + `EMAIL_FROM`（本番メール）, `NEXT_PUBLIC_SITE_URL`（リンク基点）。
- 開発環境（RESEND 未設定）ではメールが飛ばないため、成功画面の招待リンクで動作確認する。
- `BASIC_AUTH_USER/PASS` 設定時は招待リンクも Basic 認証の内側になる（任意機能・通常 OFF。設定時は受信者に資格情報が必要）。

## エラーハンドリング

- 不正入力（メール形式・表示名長さ）→ フォームにエラー表示。
- 既存ユーザー → 「既に登録済みです」。
- `generateLink` / メール送信失敗 → エラー返却（メール失敗でもユーザー作成・role 設定は成功し得るため、画面の招待リンク表示で救済）。
- `verifyOtp` 失敗（期限切れ・無効トークン）→ 分かりやすいエラーページ／メッセージ。

## テスト方針

- 単体: zod 検証ロジック、メール文面組み立て、`inviteAdmin` の admin ガード（非 admin で拒否）。
- 手動 E2E:
  1. 管理者で招待 → 成功画面のリンクをコピー。
  2. シークレットウィンドウでリンクを開く → パスワード設定 → `/admin` に到達。
  3. 一覧で当該ユーザーが「有効」表示。受諾前は「招待中」表示。
- 既存の typecheck（`tsc --noEmit`）・lint（`eslint`）を通すこと。

## 実装ファイル一覧（新規/変更）

新規:
- `app/admin/admins/page.tsx`
- `app/admin/admins/invite-admin-form.tsx`
- `app/admin/admins/actions.ts`
- `app/auth/confirm/route.ts`
- `app/auth/set-password/page.tsx`
- `app/auth/set-password/actions.ts`
- `lib/email/invite.ts`

変更:
- `app/admin/layout.tsx`（サイドバーリンク追加）
