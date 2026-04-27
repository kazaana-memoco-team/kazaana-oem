import { createClient } from "@/lib/supabase/server";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email/templates";
import {
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/documents/types";
import { TemplateForm } from "./template-form";

export const dynamic = "force-dynamic";

const TYPES: DocumentType[] = ["quote", "invoice", "delivery", "receipt"];

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("system_settings")
    .select("key, value")
    .in(
      "key",
      TYPES.map((t) => `email.${t}`),
    );

  const overrides = new Map(
    (rows ?? []).map((r) => [r.key as string, r.value as { subject: string; body: string }]),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">テンプレート</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        書類発行時に顧客へ自動送信されるメールの件名・本文を編集できます。
      </p>

      <section className="mt-6 rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">利用可能なプレースホルダ</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          <li><code>{"{{customer_name}}"}</code> 顧客名</li>
          <li><code>{"{{document_number}}"}</code> OEM注文番号</li>
          <li><code>{"{{document_type}}"}</code> 書類種別</li>
          <li><code>{"{{document_url}}"}</code> 書類URL</li>
          <li><code>{"{{amount}}"}</code> 金額</li>
          <li><code>{"{{company}}"}</code> 発行元会社名</li>
        </ul>
      </section>

      <div className="mt-8 space-y-10">
        {TYPES.map((type) => {
          const def = DEFAULT_EMAIL_TEMPLATES[type];
          const override = overrides.get(`email.${type}`);
          return (
            <section key={type}>
              <h2 className="text-lg font-medium">
                {DOCUMENT_TYPE_LABEL[type]} 発行メール
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {override
                  ? "カスタムテンプレートが保存されています。"
                  : "デフォルトテンプレートを使用中（保存するとカスタムに切り替わります）。"}
              </p>
              <div className="mt-3">
                <TemplateForm
                  type={type}
                  defaultSubject={def.subject}
                  defaultBody={def.body}
                  initialSubject={override?.subject ?? def.subject}
                  initialBody={override?.body ?? def.body}
                  isOverride={!!override}
                />
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
