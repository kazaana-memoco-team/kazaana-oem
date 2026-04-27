import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  awaiting_quote: "見積もり依頼中",
  quoted: "見積もり提示済み",
  paid: "支払い完了",
  in_production: "製作中",
  shipped: "発送済み",
  completed: "完了",
  cancelled: "キャンセル",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, type, estimated_price, customization, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">マイページ</h1>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            ログアウト
          </Button>
        </form>
      </div>

      <section className="mt-8 rounded-lg border p-6">
        <h2 className="text-lg font-medium">アカウント情報</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">お名前</dt>
            <dd>{profile?.display_name ?? "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">メール</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">ロール</dt>
            <dd>{profile?.role ?? "-"}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-lg border p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">注文一覧</h2>
          <Link
            href="/customize"
            className="text-sm underline underline-offset-4"
          >
            カスタマイズして注文する →
          </Link>
        </div>

        {!orders || orders.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            まだ注文はありません。
          </p>
        ) : (
          <ul className="mt-4 divide-y">
            {orders.map((o) => {
              const cust = o.customization as Record<string, unknown> | null;
              const productTitle =
                (cust?.product_title as string) ??
                (cust?.handle as string) ??
                "（不明な商品）";
              const variantTitle = cust?.variant_title as string | undefined;
              return (
                <li key={o.id} className="py-3">
                  <Link
                    href={`/account/orders/${o.id}`}
                    className="block group"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="line-clamp-1 text-sm font-medium group-hover:underline">
                        {productTitle}
                      </p>
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs">
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {variantTitle ? `${variantTitle}　` : ""}
                      {o.estimated_price
                        ? `概算 ${formatYen(o.estimated_price)}　`
                        : ""}
                      {new Date(o.created_at).toLocaleDateString("ja-JP")}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}
