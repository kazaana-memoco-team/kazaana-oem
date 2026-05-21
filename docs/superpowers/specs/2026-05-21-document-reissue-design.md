# 書類の再発行 ＋ 確定金額の反映 — 設計書

- 日付: 2026-05-21
- 対象: 見積書 / 請求書 / 納品書 / 領収書（`document_type`）
- 操作主体: 管理者（admin）のみ

## 背景・課題

現状の書類発行の仕組み:

- 書類は「1注文 × 1種類につき1通」。`documents` テーブルに `(order_id, type)` のユニーク制約がある。
- 発行済みの種類は管理画面のボタンが無効化され、再発行できない（`issueDocumentWithNotifications` が `already issued` を返す）。
- 書類本文の金額は **「カスタマイズの単価 × 数量 ＋ 手数料」** から計算される（画面ビューア・PDF とも）。管理画面で入力する **確定金額 `final_price` は保存値として持つだけで、書類本文には一切出ない**。
- 確定金額の保存時に見積書が「初回1回だけ」自動発行される。

このため、価格を交渉・変更しても、書類を最新内容で作り直す手段がなく、また確定金額が書類に反映されない。

## ゴール

1. 管理者が、発行済みの書類を**最新の注文データ・確定金額で作り直せる**（再発行）。
2. 確定金額 `final_price` がセットされていれば、それを**書類本文の合計金額に反映**する。
3. 再発行時は**常に**顧客へ通知する（メール送信 ＋ チャットへ発行メッセージ投稿）。

## 設計判断（確定事項）

- **再発行の目的**: 確定金額・内容の更新後に作り直す（管理者操作）。
- **通知**: 再発行時も初回と同じく必ずメール＋チャット通知を送る。
- **金額**: 確定金額がある場合は書類本文に反映する。
- **明細の見せ方**: 既存の明細行はそのまま残し、確定金額と明細合計に差があるときだけ末尾に「調整」行（差額）を追加して合計を確定金額に一致させる。確定金額が明細合計と一致する通常ケースでは見た目は変わらない。

## 実装方針

### 1. 確定金額を明細に反映（明細生成の一本化）

現状、明細（line items）が2か所で別々に組み立てられている:

- PDF 用: [lib/documents/build-items.ts](../../../lib/documents/build-items.ts) の `buildLineItemsFromOrder(customization)`
- 画面ビューア用: [app/documents/[id]/page.tsx](../../../app/documents/[id]/page.tsx) 内のインライン計算（同等ロジックの重複）

これを `buildLineItemsFromOrder` に一本化する。

- シグネチャを `buildLineItemsFromOrder(customization, finalPrice?: number | null)` に拡張。
- 関数内で従来どおり明細を組み立て、その小計（`subtotal = Σ unitPrice × quantity`）を計算。
- `finalPrice != null && finalPrice !== subtotal` のとき、末尾に調整行を追加:
  ```ts
  { description: "調整", unitPrice: finalPrice - subtotal, quantity: 1 }
  ```
  差額が負なら値引き表示（`-¥…`）、正なら加算表示。
- `finalPrice` が null（未設定）なら調整行なし＝従来と完全に同じ挙動（後方互換）。
- 画面ビューア（`app/documents/[id]/page.tsx`）のインライン明細計算を削除し、`buildLineItemsFromOrder(order.customization, order.final_price)` を呼ぶように変更。
- PDF 生成（`lib/documents/issue.ts`）も `buildLineItemsFromOrder(order.customization, order.final_price)` を呼ぶように変更。

税は [components/documents/document-template.tsx](../../../components/documents/document-template.tsx) が内税計算（`TAX_RATE = 0.1`）。合計が確定金額になれば内税額（`total - total/(1+TAX_RATE)`）も自動で正しくなる。テンプレート自体は変更不要。

### 2. 再発行ロジック（`issueDocumentWithNotifications`）

[lib/documents/issue.ts](../../../lib/documents/issue.ts) に `allowReissue?: boolean`（既定 `false`）を追加。

挙動:

| 既存書類 | `allowReissue` | 動作 |
|---|---|---|
| あり | `false` | 従来どおり `error: "already issued"` を返す（**自動発行の「初回1回だけ」を維持**） |
| あり | `true` | 既存行を **更新**（再発行） |
| なし | 任意 | 従来どおり **新規挿入**（初回発行） |

再発行（既存あり ＆ allowReissue=true）の処理:

- `documents` の該当行を更新: `amount`（= `final_price ?? estimated_price`）、`issued_by`、`created_at = now()`。
  - `created_at` を現在時刻に更新することで、一覧・ビューア・PDF の発行日、請求書の支払期限（`created_at + 30日`）が最新化される。
  - 各回の発行記録は `order_events` に残るため監査履歴は失われない。
- チャット投稿: 文言を `isReissue` で出し分け（例: 「📄 {label}（{番号}）を再発行しました。」）。常に投稿。
- メール送信: 初回と同じテンプレートで常に送信。
- PDF 再生成 ＋ Drive 反映（下記 3）。
- `order_events` の `document_issued` payload に `reissued: isReissue` を含める。

戻り値（`IssueResult`）の形は変更しない（`documentId` 等は更新時も既存行 ID を返す）。

### 3. Drive のファイル上書き

[lib/google/drive.ts](../../../lib/google/drive.ts) に関数を追加:

```ts
export async function updateFileContent(args: {
  fileId: string;
  mimeType: string;
  content: Buffer | string;
}): Promise<{ id: string; webViewLink: string | null }>;
```

`drive.files.update`（`media` 付き、`supportsAllDrives: true`）で既存ファイルの中身を差し替える。

`issue.ts` の PDF/Drive ステップ:

- 再発行 ＆ `metadata.drive_file_id` あり → `updateFileContent` で上書き（Drive に重複ファイルを作らない）。
- それ以外 → 従来どおり `uploadFileToFolder` で新規作成。
- 取得した `drive_file_id` / `drive_view_url` を `metadata` に保存。上書き時に `webViewLink` が返らない場合は既存の URL を維持する。

### 4. 管理画面 UI

[app/admin/orders/[id]/issue-document-buttons.tsx](../../../app/admin/orders/[id]/issue-document-buttons.tsx):

- 発行済みの種類: ボタンを無効の「{label} ✓」から、有効の「**再発行**」（`variant="outline"`）に変更。
- クリック時、`confirm("顧客に通知（メール・チャット）が再送されます。{label} を再発行しますか？")` で確認。OK のときのみ実行。
- 実行中は「再発行中…」表示。
- 未発行の種類: 従来どおり「{label} を発行」。
- 補足テキストを再発行に触れる内容へ更新。

[app/admin/orders/[id]/document-actions.ts](../../../app/admin/orders/[id]/document-actions.ts) の `issueDocument` サーバーアクション:

- `issueDocumentWithNotifications({ ..., allowReissue: true })` を渡す（手動ボタンは常に再発行可）。
- 既存の `revalidatePath` はそのまま。

[app/admin/orders/[id]/actions.ts](../../../app/admin/orders/[id]/actions.ts) の確定金額保存時の自動発行は **変更しない**（`allowReissue` 既定 false のまま → 初回1回だけ）。

## スコープ外

- 確定金額の保存時に毎回自動で再発行・再通知すること（保存のたびに通知が飛ぶのを避けるため、再発行は手動ボタン）。
- 顧客ページからの再発行（発行は管理者のみ。顧客は従来どおり閲覧・印刷・Drive 閲覧が可能）。
- 単価そのものを管理画面から編集する機能。
- DB マイグレーション（既存の `amount` / `created_at` / `metadata` を再利用。更新は service-role クライアント経由で RLS をバイパスして実施するため、新たな update ポリシーも不要）。

## テスト観点

- `buildLineItemsFromOrder`:
  - `finalPrice` 未指定 → 従来と同じ明細（調整行なし）。
  - `finalPrice === subtotal` → 調整行なし。
  - `finalPrice > subtotal` / `< subtotal` → 差額の調整行が付き、合計＝finalPrice。
- `issueDocumentWithNotifications`:
  - 未発行 → 新規挿入。
  - 発行済み ＆ `allowReissue=false` → `already issued`。
  - 発行済み ＆ `allowReissue=true` → 既存行更新・`created_at` 更新・通知実行・`reissued:true` イベント。
- 画面ビューア / PDF が確定金額を反映した同一の合計を表示すること。
