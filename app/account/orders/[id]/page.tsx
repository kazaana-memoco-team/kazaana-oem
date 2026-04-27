import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import {
  OrderChat,
  type ChatMessage,
  type ChatParticipant,
} from "@/components/chat/order-chat";
import { CheckoutButton } from "./checkout-button";
import { getProductByHandle } from "@/lib/shopify/products";
import { DocumentsList } from "@/components/documents/documents-list";
import type { IssuedDocument } from "@/lib/documents/types";

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

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !order) notFound();

  const { data: documentsRaw } = await supabase
    .from("documents")
    .select(
      "id, order_id, type, document_number, amount, notes, issued_by, metadata, created_at",
    )
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  const documents: IssuedDocument[] = (documentsRaw ?? []) as IssuedDocument[];

  const { data: messagesRaw } = await supabase
    .from("messages")
    .select("id, order_id, sender_id, body, sender_context, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  const initialMessages: ChatMessage[] = messagesRaw ?? [];

  const participantIds = Array.from(
    new Set(
      [
        order.customer_id,
        order.assigned_craftsman_id,
        ...initialMessages.map((m) => m.sender_id),
      ].filter((v): v is string => Boolean(v)),
    ),
  );

  const { data: profilesRaw } = participantIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, role")
        .in("id", participantIds)
    : { data: [] };

  const participants: ChatParticipant[] = (profilesRaw ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    role: p.role,
  }));

  const customization = order.customization as Record<string, unknown> | null;
  const variantTitle = (customization?.variant_title as string) ?? "-";
  const productTitle = (customization?.product_title as string) ?? "-";
  const quantity = (customization?.quantity as number) ?? 1;
  const unitPrice = (customization?.unit_price as number) ?? 0;
  const textEngraving = (customization?.text_engraving as string | null) ?? null;
  const giftMessage = (customization?.gift_message as string | null) ?? null;
  const giftWrap = (customization?.gift_wrap as boolean) ?? false;
  const notes = (customization?.notes as string | null) ?? null;
  const craftsmanDisplayName =
    (customization?.craftsman_display_name as string | null) ?? null;
  // Image: prefer one stored on the order, otherwise fetch live from Shopify.
  let productImageUrl =
    (customization?.product_image_url as string | null) ?? null;
  let productImageAlt =
    (customization?.product_image_alt as string | null) ?? productTitle;
  if (!productImageUrl && customization?.handle) {
    try {
      const liveProduct = await getProductByHandle(
        customization.handle as string,
      );
      if (liveProduct?.featuredImage) {
        productImageUrl = liveProduct.featuredImage.url;
        productImageAlt =
          liveProduct.featuredImage.altText ?? liveProduct.title;
      }
    } catch {
      // Non-fatal: fall back to no image
    }
  }

  return (
    <main className="md:flex md:h-svh">
      {/* Left: scrollable content */}
      <div className="px-4 py-8 pb-28 md:flex-1 md:basis-[65%] md:overflow-y-auto md:px-8 md:pb-8 lg:px-12">
        <Link
          href="/account"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← マイページ
        </Link>

        <header className="my-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">注文詳細</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              注文ID: <code className="rounded bg-muted px-1">{order.id}</code>
            </p>
          </div>
          <span className="rounded-full border px-3 py-1 text-xs">
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </header>

        <div className="border bg-background">
          <div className="divide-y">
            {productImageUrl ? (
              <section className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                <Image
                  src={productImageUrl}
                  alt={productImageAlt}
                  fill
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="object-cover"
                  priority
                />
              </section>
            ) : null}

            <BentoSection title="商品">
            <Row label="商品名">{productTitle}</Row>
            <Row label="バリアント">{variantTitle}</Row>
            <Row label="数量">{quantity}</Row>
            <Row label="単価">{formatYen(unitPrice)}</Row>
            {craftsmanDisplayName ? (
              <Row label="作り手">{craftsmanDisplayName}</Row>
            ) : null}
          </BentoSection>

          <BentoSection title="カスタマイズ内容">
            <Row label="名入れ">
              {textEngraving || <Muted>なし</Muted>}
            </Row>
            <Row label="ギフトラッピング">
              {giftWrap ? "あり" : <Muted>なし</Muted>}
            </Row>
            <Row label="ギフトメッセージ">
              {giftMessage || <Muted>なし</Muted>}
            </Row>
            <Row label="備考">
              <span className="whitespace-pre-wrap">
                {notes || <Muted>なし</Muted>}
              </span>
            </Row>
          </BentoSection>

          <BentoSection title="書類">
            <DocumentsList documents={documents} />
          </BentoSection>

          <BentoSection title="金額">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">概算金額</span>
              <span>{formatYen(order.estimated_price ?? 0)}</span>
            </div>
            {order.final_price != null ? (
              <div className="mt-1 flex justify-between text-sm font-medium">
                <span>確定金額</span>
                <span>{formatYen(order.final_price)}</span>
              </div>
            ) : null}

            {(order.status === "awaiting_quote" ||
              order.status === "quoted") &&
            order.customer_id === user.id ? (
              <div className="mt-5">
                <CheckoutButton
                  orderId={order.id}
                  existingCheckoutUrl={order.checkout_url}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  ボタンを押すとShopifyの決済画面（thebecos.com）にリダイレクトします。
                </p>
              </div>
            ) : null}
            {order.status === "paid" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                支払い完了。職人が製作を開始します。
              </p>
            ) : null}
            </BentoSection>
          </div>
        </div>
      </div>

      {/* Right: chat. On desktop = 35% column with full viewport height.
          On mobile, OrderChat itself handles a fixed footer banner — the
          aside contributes no visible space because its inline panel has
          `hidden md:block` and the mobile banner is fixed-positioned. */}
      <aside className="md:basis-[35%] md:border-l md:h-svh">
        <OrderChat
          orderId={order.id}
          currentUserId={user.id}
          initialMessages={initialMessages}
          participants={participants}
        />
      </aside>
    </main>
  );
}

function BentoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-6">
      <h2 className="text-sm font-medium tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-3 space-y-1">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex-1 break-words">{children}</dd>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}
