/**
 * Email templates for document issuance notifications.
 * Defaults live here; admin can override via /admin/templates which writes
 * to the public.system_settings table (key = `email.<type>`).
 *
 * Placeholders supported in subject and body (substituted at send time):
 *   {{customer_name}}    : 顧客名（display_name）
 *   {{document_number}}  : OEM注文番号（OEM000001）
 *   {{document_type}}    : 見積書 / 請求書 / 納品書 / 領収書
 *   {{document_url}}     : 印刷ページのURL
 *   {{amount}}           : 金額（¥xx,xxx）
 *   {{company}}          : 発行元会社名
 */

import type { DocumentType } from "@/lib/documents/types";

export type EmailTemplate = {
  subject: string;
  body: string;
};

export const DEFAULT_EMAIL_TEMPLATES: Record<DocumentType, EmailTemplate> = {
  quote: {
    subject: "【BECOS】{{document_type}}を発行いたしました（{{document_number}}）",
    body: `{{customer_name}} 様

このたびはご注文・お問い合わせ誠にありがとうございます。
ご依頼いただきました内容について、{{document_type}}を発行いたしました。

注文番号: {{document_number}}
金額: {{amount}}（税込）

下記URLよりご確認・ダウンロードいただけます。
{{document_url}}

ご不明な点がございましたら、マイページ内のチャットよりお気軽にお問い合わせください。

{{company}}`,
  },
  invoice: {
    subject: "【BECOS】{{document_type}}を発行いたしました（{{document_number}}）",
    body: `{{customer_name}} 様

このたびはお買い上げいただき誠にありがとうございます。
{{document_type}}を発行いたしましたので、ご確認ください。

注文番号: {{document_number}}
金額: {{amount}}（税込）

{{document_url}}

{{company}}`,
  },
  delivery: {
    subject: "【BECOS】{{document_type}}を発行いたしました（{{document_number}}）",
    body: `{{customer_name}} 様

商品の準備が整いました。
{{document_type}}を発行いたしましたのでご確認ください。

注文番号: {{document_number}}

{{document_url}}

{{company}}`,
  },
  receipt: {
    subject: "【BECOS】{{document_type}}を発行いたしました（{{document_number}}）",
    body: `{{customer_name}} 様

このたびはご購入いただき誠にありがとうございます。
ご入金を確認のうえ、{{document_type}}を発行いたしました。

注文番号: {{document_number}}
金額: {{amount}}（税込）

{{document_url}}

{{company}}`,
  },
};

export function applyTemplate(
  tpl: EmailTemplate,
  vars: Record<string, string>,
): EmailTemplate {
  const replace = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
  return { subject: replace(tpl.subject), body: replace(tpl.body) };
}
