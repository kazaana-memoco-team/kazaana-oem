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

// Status pill tones — keep neutral but give the active states a hint of color.
const STATUS_TONES: Record<string, string> = {
  awaiting_quote: "border-amber-300 bg-amber-50 text-amber-700",
  quoted: "border-amber-300 bg-amber-50 text-amber-700",
  paid: "border-emerald-300 bg-emerald-50 text-emerald-700",
  in_production: "border-blue-300 bg-blue-50 text-blue-700",
  shipped: "border-blue-300 bg-blue-50 text-blue-700",
  completed: "border-muted-foreground/30 bg-muted text-muted-foreground",
  cancelled: "border-muted-foreground/30 bg-muted text-muted-foreground",
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
    .select(
      "id, status, type, estimated_price, final_price, customization, created_at",
    )
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
      : Promise.resolve({
          data: [] as { order_id: string; last_read_at: string }[],
        }),
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

  const orderCount = orders?.length ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold sm:text-3xl">マイページ</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.display_name
              ? `${profile.display_name} さん`
              : user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {profile?.role === "admin" ? <AdminViewToggle /> : null}
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              ログアウト
            </Button>
          </form>
        </div>
      </header>

      {/* New-message banner */}
      {totalUnread > 0 ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span aria-hidden className="text-lg">
            📩
          </span>
          <p className="text-sm">
            BECOSから <span className="font-semibold">{totalUnread}件</span>
            の新しいメッセージがあります。
          </p>
        </div>
      ) : null}

      {/* Quick actions — primary entry points, prominent on mobile and PC */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/customize"
          className="group flex items-center justify-between gap-3 rounded-xl border bg-background p-5 transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <div className="min-w-0">
            <p className="font-medium">商品をカスタマイズ</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              既存のBECOS商品に名入れ・ギフト対応
            </p>
          </div>
          <span
            aria-hidden
            className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
        <Link
          href="/custom-order"
          className="group flex items-center justify-between gap-3 rounded-xl border bg-background p-5 transition-colors hover:border-primary/50 hover:bg-muted/40"
        >
          <div className="min-w-0">
            <p className="font-medium">ゼロから相談</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              フルカスタムオーダーを職人に依頼
            </p>
          </div>
          <span
            aria-hidden
            className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      </section>

      {/* Account info */}
      <section className="mt-6 rounded-xl border bg-background p-5 sm:p-6">
        <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
          アカウント情報
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">お名前</dt>
            <dd className="break-words">{profile?.display_name ?? "-"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">メール</dt>
            <dd className="break-all">{user.email}</dd>
          </div>
        </dl>
      </section>

      {/* Orders */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">
            注文一覧
            {orderCount > 0 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {orderCount}件
              </span>
            ) : null}
          </h2>
          <Link
            href="/customize"
            className="text-sm underline underline-offset-4"
          >
            新しく注文 →
          </Link>
        </div>

        {!orders || orders.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              まだ注文はありません。
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
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
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
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
              const statusTone =
                STATUS_TONES[o.status] ?? "border bg-background";

              return (
                <li key={o.id}>
                  <Link
                    href={`/account/orders/${o.id}`}
                    className={`group flex h-full flex-col rounded-xl border p-4 transition-colors hover:bg-muted/40 ${
                      unread > 0 ? "border-primary/40 bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium group-hover:underline">
                          {productTitle}
                        </p>
                        {variantTitle ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {variantTitle}
                          </p>
                        ) : null}
                      </div>
                      {unread > 0 ? (
                        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                          新着 {unread}
                        </span>
                      ) : null}
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

                    <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${statusTone}`}
                      >
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {price != null ? `${formatYen(price)}　` : ""}
                        {new Date(o.created_at).toLocaleDateString("ja-JP", {
                          timeZone: "Asia/Tokyo",
                        })}
                      </span>
                    </div>
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
