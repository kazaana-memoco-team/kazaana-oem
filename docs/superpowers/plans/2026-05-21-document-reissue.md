# 書類の再発行 ＋ 確定金額の反映 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理者が発行済みの書類（見積書等）を最新の注文データ・確定金額で作り直せるようにし、確定金額を書類本文の合計に反映する。

**Architecture:** 明細生成を `buildLineItemsFromOrder` に一本化して確定金額の「調整行」を導入。`issueDocumentWithNotifications` に `allowReissue` を追加し、発行済みなら既存行を更新（PDF再生成・Drive上書き・常に通知）。管理画面のボタンを「再発行」化する。DB変更なし。

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Supabase / Google Drive API (googleapis) / vitest（純関数テスト用に新規導入）

**前提:** 現在 `main` ブランチ上。作業前に必ずブランチを切ること（下記 Task 1 のステップ1）。仕様書: [docs/superpowers/specs/2026-05-21-document-reissue-design.md](../specs/2026-05-21-document-reissue-design.md)

---

## File Structure

- `vitest.config.ts` — **新規**: vitest 設定（`@/` エイリアス解決、node 環境）
- `package.json` — **修正**: `vitest` 追加、`test` スクリプト追加
- `tsconfig.json` — **修正**: `exclude` に `**/*.test.ts` を追加（Next ビルドの型チェック対象から除外）
- `lib/documents/build-items.ts` — **修正**: `buildLineItemsFromOrder(customization, finalPrice?)` に拡張、調整行ロジック
- `lib/documents/build-items.test.ts` — **新規**: 調整行ロジックのユニットテスト
- `app/documents/[id]/page.tsx` — **修正**: インライン明細計算を削除し `buildLineItemsFromOrder` を使用
- `lib/google/drive.ts` — **修正**: `updateFileContent` を追加
- `lib/documents/issue.ts` — **修正**: `allowReissue` 追加、insert-or-update、Drive上書き、通知文言、`reissued` イベント
- `app/admin/orders/[id]/document-actions.ts` — **修正**: 手動ボタン経路で `allowReissue: true`
- `app/admin/orders/[id]/issue-document-buttons.tsx` — **修正**: 発行済みボタンを「再発行」化（confirm 付き）

---

## Task 1: vitest 導入 ＋ 明細の調整行（確定金額反映）

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/documents/build-items.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json:33`
- Modify: `lib/documents/build-items.ts`

- [ ] **Step 1: 作業ブランチを作成**

Run:
```bash
git checkout -b feat/document-reissue
```
Expected: `Switched to a new branch 'feat/document-reissue'`

- [ ] **Step 2: vitest をインストール**

Run:
```bash
npm install -D vitest
```
Expected: インストール成功。`package.json` の `devDependencies` に `vitest` が入る。

- [ ] **Step 3: `package.json` に test スクリプトを追加**

`scripts` に次の1行を追加（既存の `lint` の隣など）:
```json
"test": "vitest run",
```

- [ ] **Step 4: `vitest.config.ts` を作成**

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // tsconfig の "@/*" -> "./*" を再現（スラッシュ落ち回避のため正規表現で）
    alias: [{ find: /^@\/(.*)$/, replacement: `${root}/$1` }],
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
```

- [ ] **Step 5: `tsconfig.json` の exclude にテストを追加**

[tsconfig.json:33](../../../tsconfig.json#L33) を変更:
```json
  "exclude": ["node_modules", "**/*.test.ts"]
```

- [ ] **Step 6: 失敗するテストを書く**

Create `lib/documents/build-items.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildLineItemsFromOrder } from "./build-items";

// handle なし -> DEFAULT_OEM_FEES。名入れ/ギフトなしなので商品1行のみ。
// subtotal = 10000 * 100 = 1,000,000
const baseCustomization = {
  product_title: "南部鉄器 急須",
  variant_title: "黒",
  unit_price: 10000,
  quantity: 100,
};

function total(items: { unitPrice: number; quantity: number }[]): number {
  return items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
}

describe("buildLineItemsFromOrder", () => {
  it("finalPrice 省略時は調整行を付けない（従来挙動）", () => {
    const items = buildLineItemsFromOrder(baseCustomization);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ unitPrice: 10000, quantity: 100 });
    expect(items.some((i) => i.description === "調整")).toBe(false);
  });

  it("finalPrice が小計と一致するときは調整行なし", () => {
    const items = buildLineItemsFromOrder(baseCustomization, 1_000_000);
    expect(items.some((i) => i.description === "調整")).toBe(false);
    expect(total(items)).toBe(1_000_000);
  });

  it("finalPrice が小計より低いとき、負の調整行で合計が一致", () => {
    const items = buildLineItemsFromOrder(baseCustomization, 950_000);
    const adj = items.find((i) => i.description === "調整");
    expect(adj).toMatchObject({ unitPrice: -50_000, quantity: 1 });
    expect(total(items)).toBe(950_000);
  });

  it("finalPrice が小計より高いとき、正の調整行で合計が一致", () => {
    const items = buildLineItemsFromOrder(baseCustomization, 1_050_000);
    const adj = items.find((i) => i.description === "調整");
    expect(adj).toMatchObject({ unitPrice: 50_000, quantity: 1 });
    expect(total(items)).toBe(1_050_000);
  });

  it("finalPrice が null のときは調整行なし", () => {
    const items = buildLineItemsFromOrder(baseCustomization, null);
    expect(items.some((i) => i.description === "調整")).toBe(false);
  });
});
```

- [ ] **Step 7: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL。`buildLineItemsFromOrder` は第2引数を無視するため、調整行を期待するケースが落ちる。

- [ ] **Step 8: `build-items.ts` を実装**

[lib/documents/build-items.ts](../../../lib/documents/build-items.ts) の関数シグネチャと末尾を変更。関数定義の冒頭を:
```ts
export function buildLineItemsFromOrder(
  customization: unknown,
  finalPrice?: number | null,
): DocumentLineItem[] {
```
に変更し、関数末尾の `return items;` を次の **ブロック全体**（最後の `return items;` を含む）で置き換える:
```ts
  // 確定金額がセットされていて明細合計と差があるとき、差額を「調整」行で吸収し
  // 合計を確定金額に一致させる（差が無ければ何も足さない＝従来と同じ見た目）。
  if (finalPrice != null) {
    const subtotal = items.reduce(
      (sum, l) => sum + l.unitPrice * l.quantity,
      0,
    );
    const diff = finalPrice - subtotal;
    if (diff !== 0) {
      items.push({ description: "調整", unitPrice: diff, quantity: 1 });
    }
  }

  return items;
```

- [ ] **Step 9: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS（5件）。

- [ ] **Step 10: コミット**

```bash
git add vitest.config.ts package.json package-lock.json tsconfig.json lib/documents/build-items.ts lib/documents/build-items.test.ts
git commit -m "feat(documents): reflect final_price via adjustment line; add vitest"
```

---

## Task 2: PDF・画面ビューアで確定金額を反映（明細生成の一本化）

**Files:**
- Modify: `lib/documents/issue.ts`（PDF 生成箇所）
- Modify: `app/documents/[id]/page.tsx`

- [ ] **Step 1: PDF 生成で finalPrice を渡す**

[lib/documents/issue.ts](../../../lib/documents/issue.ts) の PDF/Drive ステップ内、
```ts
      const items = buildLineItemsFromOrder(order.customization);
```
を次に変更:
```ts
      const items = buildLineItemsFromOrder(
        order.customization,
        order.final_price,
      );
```
（`order` の select には既に `final_price` が含まれている。）

- [ ] **Step 2: 画面ビューアのインライン明細計算を削除して共通関数へ**

[app/documents/[id]/page.tsx](../../../app/documents/[id]/page.tsx) を編集する。

(a) import を差し替え。
```ts
import {
  DocumentTemplate,
  type DocumentLineItem,
} from "@/components/documents/document-template";
```
を
```ts
import { DocumentTemplate } from "@/components/documents/document-template";
import { buildLineItemsFromOrder } from "@/lib/documents/build-items";
```
に変更し、次の行を削除:
```ts
import { getOemProduct, DEFAULT_OEM_FEES } from "@/lib/oem-products";
```

(b) `CustomizationShape` 型を、ビューアで今も使う `product_title` のみへ縮小:
```ts
type CustomizationShape = {
  product_title?: string;
};
```

(c) `const customization = ...` から `items` 配列構築まで（現行 58〜93 行付近）を、次の3行に置き換える:
```ts
  const customization = (order.customization ?? {}) as CustomizationShape;
  const productTitle = customization.product_title ?? "（不明な商品）";
  const items = buildLineItemsFromOrder(order.customization, order.final_price);
```
（`variantTitle` / `unitPrice` / `quantity` / `textEngraving` / `giftWrap` / `cfg` / `fees` / `engravingFee` / `giftWrapFee` と旧 `items` 構築ブロックは削除。`productTitle` は後段の領収書 meta（`${productTitle} の代金として`）で使うため残す。）

(d) それ以降（`recipientName` 以降〜 `DocumentTemplate` の利用）は変更不要。`items` の型は `DocumentLineItem[]` が推論されるため、明示の型注釈は不要。

- [ ] **Step 3: lint を実行**

Run: `npm run lint`
Expected: エラーなし（未使用 import が残っていないこと）。

- [ ] **Step 4: ビルドを実行**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 5: コミット**

```bash
git add lib/documents/issue.ts "app/documents/[id]/page.tsx"
git commit -m "feat(documents): render final_price total in viewer and PDF"
```

---

## Task 3: Drive に上書き更新の関数を追加

**Files:**
- Modify: `lib/google/drive.ts`

- [ ] **Step 1: `updateFileContent` を追加**

[lib/google/drive.ts](../../../lib/google/drive.ts) の末尾（`uploadFileToFolder` の後）に追加:
```ts
/**
 * Replace the content of an existing Drive file, keeping the same file ID.
 * Used when re-issuing a document so we don't create duplicate files.
 */
export async function updateFileContent(args: {
  fileId: string;
  mimeType: string;
  content: Buffer | string;
}): Promise<{ id: string; webViewLink: string | null }> {
  const drive = getDriveClient();
  const body =
    typeof args.content === "string"
      ? Readable.from([args.content])
      : Readable.from(args.content);

  const res = await drive.files.update({
    fileId: args.fileId,
    media: {
      mimeType: args.mimeType,
      body,
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  return {
    id: res.data.id ?? args.fileId,
    webViewLink: res.data.webViewLink ?? null,
  };
}
```

- [ ] **Step 2: lint を実行**

Run: `npm run lint`
Expected: エラーなし。

- [ ] **Step 3: コミット**

```bash
git add lib/google/drive.ts
git commit -m "feat(drive): add updateFileContent for in-place file replacement"
```

---

## Task 4: 再発行ロジック（issue.ts）と手動発行アクション

**Files:**
- Modify: `lib/documents/issue.ts`
- Modify: `app/admin/orders/[id]/document-actions.ts`

- [ ] **Step 1: `updateFileContent` を import**

[lib/documents/issue.ts](../../../lib/documents/issue.ts) の Drive import を変更:
```ts
import { uploadFileToFolder } from "@/lib/google/drive";
```
を
```ts
import { uploadFileToFolder, updateFileContent } from "@/lib/google/drive";
```

- [ ] **Step 2: `allowReissue` を引数に追加**

`issueDocumentWithNotifications` の引数型（`issuedBy?` の下）に追加:
```ts
  /** 発行済みでも再発行（既存行を更新）するか。既定は false（初回のみ）。 */
  allowReissue?: boolean;
```

- [ ] **Step 3: 「Skip if already issued」を再発行対応へ変更**

現行の existing チェック（「2) Skip if already issued」ブロック）全体を次に置き換え:
```ts
  // 2) Existing document for this (order, type)?
  const { data: existing } = await supabase
    .from("documents")
    .select("id, metadata")
    .eq("order_id", orderId)
    .eq("type", type)
    .maybeSingle();
  if (existing && !args.allowReissue) {
    return {
      type,
      emailed: false,
      chatPosted: false,
      error: "already issued",
    };
  }
  const isReissue = !!existing;
  const existingMeta = (existing?.metadata ?? {}) as {
    drive_file_id?: string | null;
    drive_view_url?: string | null;
  };
```

- [ ] **Step 4: insert を insert-or-update に変更**

現行の「4) Insert」ブロック（`const { data: inserted, error: insertErr } = ...` から `}` まで）を次に置き換え:
```ts
  // 4) Insert (initial) or update (re-issue) the document row
  let documentId: string;
  if (existing) {
    const { error: updateErr } = await supabase
      .from("documents")
      .update({
        document_number: order.order_number,
        amount,
        issued_by: issuedBy,
        // 再発行時は発行日を更新（一覧/ビューア/PDF の発行日・支払期限が最新化される）
        created_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (updateErr) {
      return {
        type,
        emailed: false,
        chatPosted: false,
        error: updateErr.message,
      };
    }
    documentId = existing.id;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("documents")
      .insert({
        order_id: orderId,
        type,
        document_number: order.order_number,
        amount,
        issued_by: issuedBy,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      return {
        type,
        emailed: false,
        chatPosted: false,
        error: insertErr?.message ?? "insert failed",
      };
    }
    documentId = inserted.id;
  }
```

- [ ] **Step 5: 後続の `inserted.id` 参照を `documentId` に置換**

同ファイル内、以降の3箇所を変更:
- `const documentUrl = \`${baseUrl}/documents/${inserted.id}\`;` → `${documentId}`
- PDF メタ保存の `.eq("id", inserted.id);` → `.eq("id", documentId);`
- order_events payload の `document_id: inserted.id,` → `document_id: documentId,`

- [ ] **Step 6: チャット文言を発行/再発行で出し分け**

「6) Chat message」内の body を変更:
```ts
      body: `📄 ${label}（${order.order_number}）を${
        isReissue ? "再発行" : "発行"
      }しました。\n${documentUrl}`,
```

- [ ] **Step 7: Drive を上書き対応に変更**

「8) PDF generation + Drive upload」内、`const uploaded = await uploadFileToFolder({ ... });` と直後の `driveFileId = uploaded.id; driveUrl = uploaded.webViewLink;` を次に置き換え:
```ts
      if (isReissue && existingMeta.drive_file_id) {
        const updated = await updateFileContent({
          fileId: existingMeta.drive_file_id,
          mimeType: "application/pdf",
          content: pdf,
        });
        driveFileId = updated.id;
        driveUrl = updated.webViewLink ?? existingMeta.drive_view_url ?? null;
      } else {
        const uploaded = await uploadFileToFolder({
          parentId: folderId,
          fileName: `${order.order_number}_${label}.pdf`,
          mimeType: "application/pdf",
          content: pdf,
        });
        driveFileId = uploaded.id;
        driveUrl = uploaded.webViewLink;
      }
```

- [ ] **Step 8: order_events に `reissued` を追加**

「9) order_events」の payload に1行追加:
```ts
      reissued: isReissue,
```

- [ ] **Step 9: 手動発行アクションで再発行を許可**

[app/admin/orders/[id]/document-actions.ts](../../../app/admin/orders/[id]/document-actions.ts) の `issueDocumentWithNotifications({ ... })` 呼び出しに `allowReissue: true,` を追加:
```ts
  const result = await issueDocumentWithNotifications({
    supabase: svc,
    orderId,
    type,
    issuedBy: auth.userId,
    allowReissue: true,
  });
```
（注: [app/admin/orders/[id]/actions.ts](../../../app/admin/orders/[id]/actions.ts) の確定金額保存時の自動発行は **変更しない**。`allowReissue` 既定 false のままで「初回1回だけ」を維持。）

- [ ] **Step 10: lint とビルド**

Run: `npm run lint && npm run build`
Expected: 成功（未使用変数なし、型エラーなし）。

- [ ] **Step 11: コミット**

```bash
git add lib/documents/issue.ts "app/admin/orders/[id]/document-actions.ts"
git commit -m "feat(documents): re-issue existing documents (update row, overwrite Drive, always notify)"
```

---

## Task 5: 管理画面のボタンを「再発行」化

**Files:**
- Modify: `app/admin/orders/[id]/issue-document-buttons.tsx`

- [ ] **Step 1: ボタンの disabled / onClick / ラベルを変更**

[app/admin/orders/[id]/issue-document-buttons.tsx](../../../app/admin/orders/[id]/issue-document-buttons.tsx) の `<Button>` を次に置き換え:
```tsx
            <Button
              key={t}
              type="button"
              size="sm"
              variant={issued ? "outline" : "default"}
              disabled={!!pendingType}
              onClick={() => {
                if (issued) {
                  const ok = window.confirm(
                    `顧客に通知（メール・チャット）が再送されます。${DOCUMENT_TYPE_LABEL[t]}を再発行しますか？`,
                  );
                  if (!ok) return;
                }
                setError(null);
                setPendingType(t);
                startTransition(async () => {
                  const res = await issueDocument(orderId, t);
                  setPendingType(null);
                  if (!res.ok) {
                    setError(res.error);
                  }
                });
              }}
            >
              {busy
                ? issued
                  ? "再発行中…"
                  : "発行中…"
                : issued
                  ? `${DOCUMENT_TYPE_LABEL[t]} を再発行`
                  : `${DOCUMENT_TYPE_LABEL[t]} を発行`}
            </Button>
```

- [ ] **Step 2: 補足テキストを更新**

同ファイル末尾の補足 `<p>` を次に変更:
```tsx
      <p className="text-xs text-muted-foreground">
        通常、見積書は確定金額の保存時に・請求書/納品書/領収書は支払い完了時に自動発行されます。
        発行済みの書類は「再発行」で最新の内容（確定金額・PDF）に作り直し、顧客へ再通知します。
      </p>
```

- [ ] **Step 3: lint とビルド**

Run: `npm run lint && npm run build`
Expected: 成功。

- [ ] **Step 4: コミット**

```bash
git add "app/admin/orders/[id]/issue-document-buttons.tsx"
git commit -m "feat(admin): allow re-issuing already-issued documents"
```

---

## Task 6: 全体検証（自動 ＋ 手動）

**Files:** なし（検証のみ）

- [ ] **Step 1: 自動チェック一式**

Run: `npm test && npm run lint && npm run build`
Expected: すべて成功。

- [ ] **Step 2: 手動検証（dev サーバー）**

Run: `npm run dev`（ポート3001）

確認項目:
- 管理画面の注文詳細 `/admin/orders/<id>` で、発行済みの種類のボタンが「○○ を再発行」（outline）になっている。
- 「再発行」クリックで確認ダイアログが出る。OK で再発行され、チャットに「📄 …を再発行しました。」が出る。
- 一覧・ビューアの発行日が更新されている（再発行時刻）。
- 確定金額を変更 → 見積書を「再発行」→ `/documents/<id>` のプレビューと Drive PDF の合計が確定金額になり、確定金額が小計と異なる場合は「調整」行が出る。
- Drive 上で同じファイルが上書きされ、重複ファイルが作られていない（環境変数 `GOOGLE_DRIVE_FOLDER_*` 設定時）。
- 未発行の種類は従来どおり「○○ を発行」で初回発行できる。

- [ ] **Step 3: 検証結果を記録**

手動検証で気づいた差異があればこのファイルにメモを追記し、必要なら修正タスクを追加する。

---

## 完了条件

- `npm test` / `npm run lint` / `npm run build` がすべて成功。
- 発行済み書類を管理画面から再発行でき、確定金額・PDF・発行日が更新され、顧客に再通知される。
- 確定金額が書類本文の合計に反映される（差額は「調整」行）。
- 確定金額の自動発行は従来どおり初回のみ（再通知の暴発なし）。
