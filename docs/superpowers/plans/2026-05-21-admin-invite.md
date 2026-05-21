# 新規管理者の招待 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面サイドバーから、メール招待で新しい管理者を登録できるようにする（招待された本人がパスワードを設定して `role='admin'` で参加）。

**Architecture:** 管理者が `/admin/admins` の招待フォームでメールを送信 → サーバーアクションが service-role で `auth.admin.generateLink('invite')` を実行しユーザー作成＋`profiles.role='admin'` 更新 → 招待リンクを既存 Resend で送信。招待された本人はリンク（`/auth/confirm`）でトークン検証されセッション確立 → `/auth/set-password` でパスワード設定 → `/admin` へ。

**Tech Stack:** Next.js 16（App Router, server actions, route handler）/ Supabase（@supabase/ssr, auth-js admin API）/ Resend / zod / Tailwind + shadcn/ui。

> **テストについて:** このリポジトリにはテストランナー（vitest/jest 等）が一切存在しない。プロジェクトの慣習に合わせ、検証は `npx tsc --noEmit` ＋ `npx eslint` ＋ 開発サーバー（`http://localhost:3001`）での手動 E2E で行う。テストフレームワークの新規導入はスコープ外（YAGNI）。
>
> **コミットについて:** 現在 `main` ブランチに本機能と無関係な未コミット変更が複数ある。最初のコミット前に、ブランチを切るか／コミット範囲をどうするかをユーザーに確認すること。各タスクのコミット手順は `git add` で対象ファイルを限定している。

---

## File Structure

新規:
- `lib/email/invite.ts` — 管理者招待メールの文面組み立て＋送信（`sendEmail` ラッパ）
- `app/admin/admins/actions.ts` — `inviteAdmin` サーバーアクション（admin 検証 / 招待リンク生成 / role 付与 / メール送信）
- `app/admin/admins/invite-admin-form.tsx` — 招待フォーム（クライアント）
- `app/admin/admins/page.tsx` — 招待フォーム＋管理者一覧（サーバーコンポーネント）
- `app/auth/confirm/route.ts` — 招待/各種メールリンクのトークン検証（GET route handler）
- `app/auth/set-password/page.tsx` — パスワード設定ページ（サーバーコンポーネント）
- `app/auth/set-password/set-password-form.tsx` — パスワード設定フォーム（クライアント）
- `app/auth/set-password/actions.ts` — `setPassword` サーバーアクション

変更:
- `app/admin/layout.tsx` — サイドバーに「管理者」リンク追加

---

## Task 1: 招待メール送信ヘルパー

**Files:**
- Create: `lib/email/invite.ts`

参考: `lib/email/notify.ts`（`sendEmail` と `ISSUER` の使い方）、`lib/email/send.ts`（戻り値 `{ ok: true, id? } | { ok: false, error }`）。

- [ ] **Step 1: `lib/email/invite.ts` を作成**

```ts
import { sendEmail } from "./send";
import { ISSUER } from "@/lib/documents/issuer";

/**
 * 管理者招待メール。招待リンクを本文に入れて送る。
 * RESEND 未設定の開発環境では sendEmail が no-op となり ok:false を返す。
 */
export async function sendAdminInvite(args: {
  to: string;
  inviteUrl: string;
  displayName?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { to, inviteUrl, displayName } = args;
  const greeting = displayName ? `${displayName} 様` : "ご担当者様";

  const res = await sendEmail({
    to,
    subject: "【BECOS OEM】管理者アカウントへの招待",
    body:
      `${greeting}\n\n` +
      `BECOS OEM 管理画面の管理者として招待されました。\n` +
      `以下のリンクからパスワードを設定すると、管理者としてログインできます。\n\n` +
      `${inviteUrl}\n\n` +
      `※ このリンクには有効期限があります。期限切れの場合は再度招待を依頼してください。\n` +
      `※ お心当たりがない場合は、このメールは破棄してください。\n\n` +
      `${ISSUER.company}`,
  });

  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
```

- [ ] **Step 2: 型チェック / lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint lib/email/invite.ts`
Expected: いずれもエラー出力なし（exit 0）。

> 注: `ISSUER` のインポートパスは `notify.ts` と同じ `@/lib/documents/issuer`。もし `ISSUER.company` が存在しない場合は `lib/documents/issuer.ts` を開いて正しいプロパティ名に合わせること。

- [ ] **Step 3: コミット**

```bash
git add lib/email/invite.ts
git commit -m "feat(admin): add admin invite email helper"
```

---

## Task 2: 招待サーバーアクション `inviteAdmin`

**Files:**
- Create: `app/admin/admins/actions.ts`

参考: `app/admin/templates/actions.ts`（`requireAdmin()` パターン、zod、戻り値の判別ユニオン）、`lib/supabase/server.ts`（`createClient` / `createServiceRoleClient`）。

- [ ] **Step 1: `app/admin/admins/actions.ts` を作成**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sendAdminInvite } from "@/lib/email/invite";

/**
 * サーバーアクションは layout のガードを通らないため、ここで管理者を再検証する。
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "ログインが必要です。" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false as const, error: "管理者権限が必要です。" };
  }
  return { ok: true as const };
}

const inviteSchema = z.object({
  email: z.string().trim().email(),
  display_name: z.string().trim().max(80).optional(),
});

export type InviteAdminResult =
  | { ok: true; inviteUrl: string; emailed: boolean }
  | { ok: false; error: string };

export async function inviteAdmin(
  formData: FormData,
): Promise<InviteAdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    display_name: formData.get("display_name") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "メールアドレスを確認してください。" };
  }
  const { email, display_name } = parsed.data;

  const admin = await createServiceRoleClient();

  // generateLink('invite') がユーザーを作成し、hashed_token を返す。
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: display_name ? { data: { display_name } } : undefined,
  });
  if (linkError || !link) {
    const msg = /already|registered|exists/i.test(linkError?.message ?? "")
      ? "このメールアドレスは既に登録されています。"
      : (linkError?.message ?? "招待リンクの生成に失敗しました。");
    return { ok: false, error: msg };
  }

  // トリガーで role=customer のプロフィールが作られるため admin に昇格。
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", link.user.id);
  if (roleError) {
    return { ok: false, error: `権限設定に失敗しました: ${roleError.message}` };
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const inviteUrl =
    `${base}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}` +
    `&type=invite&next=${encodeURIComponent("/auth/set-password")}`;

  const sent = await sendAdminInvite({
    to: email,
    inviteUrl,
    displayName: display_name ?? null,
  });

  revalidatePath("/admin/admins");
  return { ok: true, inviteUrl, emailed: sent.ok };
}
```

- [ ] **Step 2: 型チェック / lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "app/admin/admins/actions.ts"`
Expected: エラー出力なし（exit 0）。

- [ ] **Step 3: コミット**

```bash
git add app/admin/admins/actions.ts
git commit -m "feat(admin): add inviteAdmin server action"
```

---

## Task 3: 招待フォーム＋管理者ページ＋サイドバーリンク

**Files:**
- Create: `app/admin/admins/invite-admin-form.tsx`
- Create: `app/admin/admins/page.tsx`
- Modify: `app/admin/layout.tsx`（`<nav>` 内にリンク追加）

参考: `app/admin/templates/template-form.tsx`（`useTransition` + `action={(formData)=>{...}}` パターン）。

- [ ] **Step 1: `app/admin/admins/invite-admin-form.tsx` を作成**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteAdmin } from "./actions";

export function InviteAdminForm() {
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    { inviteUrl: string; emailed: boolean } | null
  >(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        setResult(null);
        startTransition(async () => {
          const res = await inviteAdmin(formData);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setResult({ inviteUrl: res.inviteUrl, emailed: res.emailed });
        });
      }}
      className="space-y-4 rounded-lg border bg-background p-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="new-admin@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="display_name">表示名（任意）</Label>
        <Input
          id="display_name"
          name="display_name"
          type="text"
          maxLength={80}
          placeholder="山田太郎"
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
          <p>
            {result.emailed
              ? "招待メールを送信しました。"
              : "招待を作成しました（メール未送信）。下記リンクを共有してください。"}
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {result.inviteUrl}
          </p>
        </div>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "送信中…" : "招待を送る"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: `app/admin/admins/page.tsx` を作成**

```tsx
import { createServiceRoleClient } from "@/lib/supabase/server";
import { InviteAdminForm } from "./invite-admin-form";

export const dynamic = "force-dynamic";

type AdminRow = {
  id: string;
  displayName: string | null;
  email: string | null;
  pending: boolean;
};

export default async function AdminsPage() {
  const admin = await createServiceRoleClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  const rows: AdminRow[] = [];
  for (const p of profiles ?? []) {
    const { data } = await admin.auth.admin.getUserById(p.id);
    const u = data?.user;
    rows.push({
      id: p.id,
      displayName: p.display_name,
      email: u?.email ?? null,
      pending: !u?.email_confirmed_at,
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold tracking-tight">管理者</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        新しい管理者をメールで招待します。
      </p>

      <div className="mt-6">
        <InviteAdminForm />
      </div>

      <h2 className="mt-10 text-sm font-medium">登録済み・招待中</h2>
      <div className="mt-3 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">表示名</th>
              <th className="px-3 py-2 font-medium">メール</th>
              <th className="px-3 py-2 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.displayName ?? "—"}</td>
                <td className="px-3 py-2">{r.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={
                      r.pending
                        ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                        : "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                    }
                  >
                    {r.pending ? "招待中" : "有効"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  管理者がいません。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `app/admin/layout.tsx` の `<nav>` にリンク追加**

`app/admin/layout.tsx` の以下の箇所:

```tsx
        <nav className="flex-1 space-y-0.5 p-2">
          <AdminSidebarLink href="/admin/orders">注文一覧</AdminSidebarLink>
          <AdminSidebarLink href="/admin/templates">テンプレ</AdminSidebarLink>
        </nav>
```

を次に変更（`管理者` 行を追加）:

```tsx
        <nav className="flex-1 space-y-0.5 p-2">
          <AdminSidebarLink href="/admin/orders">注文一覧</AdminSidebarLink>
          <AdminSidebarLink href="/admin/templates">テンプレ</AdminSidebarLink>
          <AdminSidebarLink href="/admin/admins">管理者</AdminSidebarLink>
        </nav>
```

- [ ] **Step 4: 型チェック / lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "app/admin/admins/page.tsx" "app/admin/admins/invite-admin-form.tsx" "app/admin/layout.tsx"`
Expected: エラー出力なし（exit 0）。

- [ ] **Step 5: 手動確認（開発サーバー）**

Run: `npm run dev`（既に起動済みなら不要）。管理者でログインして `http://localhost:3001/admin/admins` を開く。
Expected: サイドバーに「管理者」リンク、招待フォーム、（既存管理者が）一覧に「有効」で表示される。

- [ ] **Step 6: コミット**

```bash
git add app/admin/admins/page.tsx app/admin/admins/invite-admin-form.tsx app/admin/layout.tsx
git commit -m "feat(admin): add admins page with invite form and list"
```

---

## Task 4: 招待リンク検証ルート `/auth/confirm`

**Files:**
- Create: `app/auth/confirm/route.ts`

参考: `app/api/shopify/oauth/callback/route.ts`（route handler の形・`NextRequest`・`dynamic`）。Supabase SSR 公式の confirm ルートパターンに準拠（`verifyOtp({ token_hash, type })` → `redirect(next)`）。

- [ ] **Step 1: `app/auth/confirm/route.ts` を作成**

```ts
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// verifyOtp の token_hash で使える type のサブセット（オープンリダイレクト/誤用防止のためホワイトリスト）
type ConfirmType = "invite" | "recovery" | "magiclink" | "email";
const ALLOWED_TYPES: ConfirmType[] = ["invite", "recovery", "magiclink", "email"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const typeParam = params.get("type") as ConfirmType | null;
  const nextParam = params.get("next") ?? "/";
  // 内部パスのみ許可（オープンリダイレクト防止）
  const next = nextParam.startsWith("/") ? nextParam : "/";

  if (tokenHash && typeParam && ALLOWED_TYPES.includes(typeParam)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: typeParam,
      token_hash: tokenHash,
    });
    if (!error) {
      // verifyOtp 成功でセッション cookie が確立される
      redirect(next);
    }
  }

  redirect("/login?error=invalid_or_expired_link");
}
```

> 注: `redirect()`（next/navigation）は内部的に例外を投げてリダイレクトする。`try/catch` で囲まないこと。

- [ ] **Step 2: 型チェック / lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "app/auth/confirm/route.ts"`
Expected: エラー出力なし（exit 0）。

- [ ] **Step 3: コミット**

```bash
git add app/auth/confirm/route.ts
git commit -m "feat(auth): add /auth/confirm token verification route"
```

---

## Task 5: パスワード設定ページ `/auth/set-password`

**Files:**
- Create: `app/auth/set-password/actions.ts`
- Create: `app/auth/set-password/set-password-form.tsx`
- Create: `app/auth/set-password/page.tsx`

参考: `app/actions/auth.ts`（zod, `createClient`, `redirect`, `revalidatePath` の使い方; パスワード最小 8 文字）。

- [ ] **Step 1: `app/auth/set-password/actions.ts` を作成**

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    password: z.string().min(8),
    confirm: z.string().min(8),
  })
  .refine((v) => v.password === v.confirm, {
    message: "パスワードが一致しません。",
  });

export async function setPassword(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "入力を確認してください（8文字以上）。",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "セッションが切れています。もう一度リンクを開いてください。" };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/admin");
}
```

- [ ] **Step 2: `app/auth/set-password/set-password-form.tsx` を作成**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setPassword } from "./actions";

export function SetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await setPassword(formData);
          // 成功時はサーバー側で /admin にリダイレクトされる
          if (res?.error) setError(res.error);
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="password">パスワード（8文字以上）</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">パスワード（確認）</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "設定中…" : "パスワードを設定してはじめる"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: `app/auth/set-password/page.tsx` を作成**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">パスワードを設定</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        管理者アカウントのパスワードを設定してください。
      </p>
      <div className="mt-6">
        <SetPasswordForm />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: 型チェック / lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "app/auth/set-password/actions.ts" "app/auth/set-password/set-password-form.tsx" "app/auth/set-password/page.tsx"`
Expected: エラー出力なし（exit 0）。

- [ ] **Step 5: 手動確認（未ログイン時のガード）**

シークレットウィンドウで `http://localhost:3001/auth/set-password` を開く。
Expected: `/login` にリダイレクトされる。

- [ ] **Step 6: コミット**

```bash
git add app/auth/set-password/actions.ts app/auth/set-password/set-password-form.tsx app/auth/set-password/page.tsx
git commit -m "feat(auth): add set-password page for invited admins"
```

---

## Task 6: フル検証（typecheck / lint / E2E）

**Files:** （なし — 検証のみ）

- [ ] **Step 1: 全体の型チェック / lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint .`
Expected: エラー出力なし（exit 0）。

- [ ] **Step 2: 招待〜受諾の手動 E2E**

前提: 開発環境では RESEND 未設定のためメールは飛ばない。成功画面に表示される招待リンクを使う。

1. 管理者で `http://localhost:3001/admin/admins` を開く。
2. 未登録のメール（例: テスト用エイリアス）と表示名を入力 → 「招待を送る」。
   - Expected: 「招待を作成しました（メール未送信）。下記リンクを共有してください。」とともに `…/auth/confirm?token_hash=…&type=invite&next=%2Fauth%2Fset-password` が表示される。
   - Expected: 一覧に当該メールが「招待中」で出る。
3. 表示された招待リンクを**シークレットウィンドウ**で開く。
   - Expected: `/auth/set-password` に遷移し、パスワード設定フォームが出る。
4. パスワード（8文字以上）を一致させて設定。
   - Expected: `/admin` に遷移する（= その新規ユーザーが管理者として入れる）。
5. 元の管理者ウィンドウで `/admin/admins` をリロード。
   - Expected: 当該ユーザーが「有効」に変わっている。
6. 異常系: 同じメールで再度招待 → 「このメールアドレスは既に登録されています。」
7. 異常系: 不正/期限切れトークンで `/auth/confirm?token_hash=bad&type=invite` を開く → `/login?error=invalid_or_expired_link`。

- [ ] **Step 3: クリーンアップ確認**

E2E で作成したテストユーザーは Supabase ダッシュボード（Auth > Users）から削除しておく。

---

## Self-Review 結果（spec との突き合わせ）

- spec「サイドバーリンク」→ Task 3 Step 3 ✓
- spec「招待フォーム（email 必須 / display_name 任意）」→ Task 3 Step 1 ＋ Task 2（zod）✓
- spec「generateLink('invite') ＋ role 昇格 ＋ Resend 送信 ＋ 成功画面でリンク表示」→ Task 1・2・3 ✓
- spec「admin 再検証（サーバーアクション）」→ Task 2 `requireAdmin()` ✓
- spec「`/auth/confirm` verifyOtp」→ Task 4 ✓（オープンリダイレクト対策込み）
- spec「`/auth/set-password`（セッション必須 / updateUser / `/admin` へ）」→ Task 5 ✓
- spec「一覧（有効/招待中＝email_confirmed_at）」→ Task 3 Step 2 ✓
- spec「proxy.ts 変更不要」→ いずれのタスクでも変更なし ✓
- spec「必要 env」→ `inviteAdmin` で `NEXT_PUBLIC_SITE_URL`、メールで `RESEND_API_KEY`/`EMAIL_FROM`、service-role で `SUPABASE_SECRET_KEY`（既存）✓
- 型整合: `inviteAdmin` の戻り値 `InviteAdminResult`（`inviteUrl`/`emailed`）をフォームがそのまま消費 ✓ / `sendAdminInvite` は `{ ok, error? }` を返し `inviteAdmin` が `sent.ok` を参照 ✓
