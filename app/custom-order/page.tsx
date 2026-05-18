import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomOrderForm } from "./custom-order-form";

export const dynamic = "force-dynamic";

export default async function CustomOrderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
      <Link
        href="/"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← トップ
      </Link>

      <header className="mt-6">
        <p className="text-[10pt] uppercase tracking-[0.3em] text-muted-foreground">
          Full Custom Order
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight">
          ゼロから職人と作る
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          既製品にはない、あなただけの一品。ジャンル・ご予算・完成イメージをお聞かせください。
          BECOSが内容にあった職人を探し、お見積もりとともにご提案します。
        </p>
      </header>

      <div className="mt-10">
        {user ? (
          <CustomOrderForm />
        ) : (
          <div className="rounded-lg border p-6">
            <p className="text-sm">
              カスタムオーダーのご相談にはログインが必要です。
            </p>
            <div className="mt-4 flex gap-3">
              <Link
                href="/login?redirect=/custom-order"
                className="text-sm underline underline-offset-4"
              >
                ログイン
              </Link>
              <Link
                href="/signup"
                className="text-sm underline underline-offset-4"
              >
                新規登録
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
