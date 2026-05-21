import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types/database";

export const dynamic = "force-dynamic";

const ALL_STATUSES: OrderStatus[] = [
  "draft",
  "awaiting_quote",
  "quoted",
  "paid",
  "in_production",
  "shipped",
  "completed",
  "cancelled",
];

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

const STATUS_FILTERS = [
  { value: "all", label: "すべて" },
  { value: "awaiting_quote", label: "見積もり依頼中" },
  { value: "quoted", label: "見積もり提示済み" },
  { value: "paid", label: "支払い完了" },
  { value: "in_production", label: "製作中" },
  { value: "shipped", label: "発送済み" },
  { value: "completed", label: "完了" },
  { value: "cancelled", label: "キャンセル" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filterStatus = status ?? "all";

  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, status, type, customer_id, assigned_craftsman_id, estimated_price, final_price, customization, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filterStatus !== "all" && (ALL_STATUSES as string[]).includes(filterStatus)) {
    query = query.eq("status", filterStatus as OrderStatus);
  }

  const { data: orders, error } = await query;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const orderIds = (orders ?? []).map((o) => o.id);

  // Pre-fetch customer profiles for display
  const customerIds = Array.from(
    new Set((orders ?? []).map((o) => o.customer_id).filter(Boolean)),
  );
  const { data: profiles } = customerIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", customerIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  // Unread (customer messages after admin's last read) per order
  const unreadByOrder = new Map<string, number>();
  if (user && orderIds.length) {
    const [{ data: reads }, { data: msgs }] = await Promise.all([
      supabase
        .from("order_reads")
        .select("order_id, last_read_at")
        .eq("user_id", user.id)
        .in("order_id", orderIds),
      supabase
        .from("messages")
        .select("order_id, sender_id, sender_context, created_at")
        .in("order_id", orderIds),
    ]);
    const readMap = new Map(
      (reads ?? []).map((r) => [r.order_id, r.last_read_at]),
    );
    for (const m of msgs ?? []) {
      // Admin cares about customer-context messages they haven't read
      const lastRead = readMap.get(m.order_id);
      const isFromCustomer = m.sender_context !== "admin";
      const isUnread =
        isFromCustomer && (!lastRead || m.created_at > lastRead);
      if (isUnread) {
        unreadByOrder.set(
          m.order_id,
          (unreadByOrder.get(m.order_id) ?? 0) + 1,
        );
      }
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">注文一覧</h1>
        <span className="text-xs text-muted-foreground">
          {orders?.length ?? 0} 件
        </span>
      </div>

      <nav className="mt-4 flex flex-wrap gap-1 border-b text-sm">
        {STATUS_FILTERS.map((f) => {
          const isActive = filterStatus === f.value;
          return (
            <Link
              key={f.value}
              href={`/admin/orders${f.value === "all" ? "" : `?status=${f.value}`}`}
              className={`-mb-px border-b-2 px-3 py-2 ${
                isActive
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <p className="mt-6 text-sm text-destructive">取得エラー: {error.message}</p>
      ) : !orders || orders.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">該当する注文がありません。</p>
      ) : (
        <ul className="mt-6 divide-y rounded-lg border">
          {orders.map((o) => {
            const cust = o.customization as Record<string, unknown> | null;
            const productTitle =
              (cust?.product_title as string) ??
              (cust?.title as string) ??
              (cust?.handle as string) ??
              "（不明な商品）";
            const variantTitle = cust?.variant_title as string | undefined;
            const customerName = profileMap.get(o.customer_id) ?? "—";
            return (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="block px-4 py-3 hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">
                        {productTitle}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {variantTitle ? `${variantTitle}　` : ""}
                        顧客: {customerName}
                        {new Date(o.created_at).toLocaleString("ja-JP", {
                          timeZone: "Asia/Tokyo",
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {(unreadByOrder.get(o.id) ?? 0) > 0 ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                          新着 {unreadByOrder.get(o.id)}
                        </span>
                      ) : null}
                      <span className="text-sm">
                        {o.final_price != null
                          ? formatYen(o.final_price)
                          : o.estimated_price != null
                            ? `(概算 ${formatYen(o.estimated_price)})`
                            : "—"}
                      </span>
                      <span className="rounded-full border px-2 py-0.5 text-xs">
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
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
