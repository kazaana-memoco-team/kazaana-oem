import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { AdminViewToggle } from "@/components/admin-view-toggle";

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
    .select("id, status, type, estimated_price, final_price, customization, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const orderIds = (orders ?? []).map((o) => o.id);

  // Read markers + recent messages for unread badges and previews
  const [{ data: reads }, { data: messages }] = await Promise.all([
    orderIds.length
      ? supabase
          .from("order_reads")
          .select("order_id, last_read_at")
          .eq("user_id", user.id)
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] as { order_id: string; last_read_at: string }[] }),
    orderIds.length
      ? supabase
          .from("messages")
          .select("order_id, body, sender_id, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            order_id: string;
            body: string;
            sender_id: string;
            created_at: string;
          }[],
        }),
  ]);

  const readMap = new Map(
    (reads ?? []).map((r) => [r.order_id, r.last_read_at]),
  );

  // Per-order: latest message + unread count (messages from others after last read)
  const latestByOrder = new Map<string, { body: string; created_at: string }>();
  const unreadByOrder = new Map<string, number>();
  for (const m of messages ?? []) {
    if (!latestByOrder.has(m.order_id)) {
      latestByOrder.set(m.order_id, { body: m.body, created_at: m.created_at });
    }
    const lastRead = readMap.get(m.order_id);
    const isFromOther = m.sender_id !== user.id;
    const isUnread = isFromOther && (!lastRead || m.created_at > lastRead);
    if (isUnread) {
      unreadByOrder.set(m.order_id, (unreadByOrder.get(m.order_id) ?? 0) + 1);
    }
  }

  const totalUnread = Array.from(unreadByOrder.values()).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">マイページ</h1>
        <div className="flex items-center gap-2">
          {profile?.role === "admin" ? <AdminViewToggle /> : null}
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              ログアウト
            </Button>
          </form>
        </div>
      </div>

      {/* New-message banner */}
      {totalUnread > 0 ? (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm">
            <span aria-hidden>📩 </span>
            BECOSから <span className="font-semibold">{totalUnread}件</span>{" "}
            の新しいメッセージがあります。
          </p>
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border p-6">
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
        </dl>
      </section>

      <section className="mt-6 rounded-lg border p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">注文一覧</h2>
          <Link
            href="/customize"
            className="text-sm underline underline-offset-4"
          >
            商品をカスタマイズ →
          </Link>
        </div>

        {!orders || orders.length === 0 ? (
          <div className="mt-4 rounded-lg bg-muted/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              まだ注文はありません。
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/customize" className={buttonVariants({ size: "sm" })}>
                商品をカスタマイズ
              </Link>
              <Link
                href="/custom-order"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                ゼロから相談
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((o) => {
              const cust = o.customization as Record<string, unknown> | null;
              const productTitle =
                (cust?.product_title as string) ??
                (cust?.title as string) ??
                (cust?.handle as string) ??
                "（不明な商品）";
              const variantTitle = cust?.variant_title as string | undefined;
              const unread = unreadByOrder.get(o.id) ?? 0;
              const latest = latestByOrder.get(o.id);
              const price = o.final_price ?? o.estimated_price ?? null;

              return (
                <li key={o.id}>
                  <Link
                    href={`/account/orders/${o.id}`}
                    className={`group block rounded-lg border p-4 transition-colors hover:bg-muted/40 ${
                      unread > 0 ? "border-primary/40 bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-medium group-hover:underline">
                          {productTitle}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {variantTitle ? `${variantTitle}　` : ""}
                          {price != null ? `${formatYen(price)}　` : ""}
                          {new Date(o.created_at).toLocaleDateString("ja-JP", {
                            timeZone: "Asia/Tokyo",
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="rounded-full border px-2 py-0.5 text-xs">
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                        {unread > 0 ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                            新着 {unread}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {latest ? (
                      <p
                        className={`mt-2 line-clamp-1 text-xs ${
                          unread > 0
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        <span aria-hidden>💬 </span>
                        {latest.body}
                      </p>
                    ) : null}
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
