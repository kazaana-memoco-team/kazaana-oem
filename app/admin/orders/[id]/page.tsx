import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import {
  OrderChat,
  type ChatMessage,
  type ChatParticipant,
} from "@/components/chat/order-chat";
import { AdminControls } from "./admin-controls";
import { getProductByHandle } from "@/lib/shopify/products";
import { IssueDocumentButtons } from "./issue-document-buttons";
import { DocumentsList } from "@/components/documents/documents-list";
import type {
  DocumentType,
  IssuedDocument,
} from "@/lib/documents/types";

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

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !order) notFound();

  const customization = order.customization as Record<string, unknown> | null;

  const { data: customer } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", order.customer_id)
    .maybeSingle();

  const { data: documentsRaw } = await supabase
    .from("documents")
    .select(
      "id, order_id, type, document_number, amount, notes, issued_by, metadata, created_at",
    )
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  const documents: IssuedDocument[] = (documentsRaw ?? []) as IssuedDocument[];
  const alreadyIssued: DocumentType[] = documents.map(
    (d) => d.type as DocumentType,
  );

  const { data: messagesRaw } = await supabase
    .from("messages")
    .select("id, order_id, sender_id, body, sender_context, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: true });
  const initialMessages: ChatMessage[] = messagesRaw ?? [];

  const participantIds = Array.from(
    new Set(
      [order.customer_id, ...initialMessages.map((m) => m.sender_id)].filter(
        (v): v is string => Boolean(v),
      ),
    ),
  );
  const { data: participantProfiles } = participantIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, role")
        .in("id", participantIds)
    : { data: [] };
  const participants: ChatParticipant[] = (participantProfiles ?? []).map(
    (p) => ({ id: p.id, display_name: p.display_name, role: p.role }),
  );

  const productTitle =
    (customization?.product_title as string) ?? "（不明な商品）";
  const variantTitle = (customization?.variant_title as string) ?? "-";
  const quantity = (customization?.quantity as number) ?? 1;
  const unitPrice = (customization?.unit_price as number) ?? 0;
  const textEngraving = (customization?.text_engraving as string | null) ?? null;
  const giftMessage = (customization?.gift_message as string | null) ?? null;
  const giftWrap = (customization?.gift_wrap as boolean) ?? false;
  const notes = (customization?.notes as string | null) ?? null;
  const craftsmanDisplayName =
    (customization?.craftsman_display_name as string | null) ?? null;
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
      // ignore
    }
  }

  return (
    <main className="md:flex md:h-full">
      {/* Left: scrollable content */}
      <div className="px-4 py-8 pb-28 md:flex-1 md:basis-[65%] md:overflow-y-auto md:px-8 md:pb-8 lg:px-12">
        <Link
          href="/admin/orders"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← 注文一覧
        </Link>

        <header className="my-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{productTitle}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              注文ID: <code className="rounded bg-muted px-1">{order.id}</code>
              　顧客: {customer?.display_name ?? "—"}
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

            <BentoSection title="注文内容">
            <Row label="バリアント">{variantTitle}</Row>
            <Row label="数量">{quantity}</Row>
            <Row label="単価">{formatYen(unitPrice)}</Row>
            <Row label="名入れ">{textEngraving ?? <Muted>なし</Muted>}</Row>
            <Row label="ギフトラッピング">
              {giftWrap ? "あり" : <Muted>なし</Muted>}
            </Row>
            <Row label="ギフトメッセージ">
              {giftMessage ?? <Muted>なし</Muted>}
            </Row>
            <Row label="備考">
              <span className="whitespace-pre-wrap">
                {notes ?? <Muted>なし</Muted>}
              </span>
            </Row>
          </BentoSection>

          <BentoSection title="作り手（外部対応）">
            <p className="text-sm">{craftsmanDisplayName ?? "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              この職人とは BECOS が外部（電話・メール等）でやり取りします。
              社内連絡事項は下記の社内メモに記録してください。
            </p>
          </BentoSection>

          <BentoSection title="金額">
            <Row label="概算金額">
              {order.estimated_price != null
                ? formatYen(order.estimated_price)
                : "—"}
            </Row>
            <Row label="確定金額">
              {order.final_price != null
                ? formatYen(order.final_price)
                : "未設定"}
            </Row>
            {order.checkout_url ? (
              <Row label="Checkout">
                <a
                  href={order.checkout_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  Shopify Checkout を開く
                </a>
              </Row>
            ) : null}
            {order.shopify_draft_order_id ? (
              <Row label="Draft Order">
                <code className="text-xs">
                  {order.shopify_draft_order_id}
                </code>
              </Row>
            ) : null}
          </BentoSection>

            <BentoSection title="書類">
              <IssueDocumentButtons
                orderId={order.id}
                alreadyIssued={alreadyIssued}
              />
              <div className="mt-4">
                <DocumentsList documents={documents} />
              </div>
            </BentoSection>

            <BentoSection title="管理操作">
              <AdminControls
                orderId={order.id}
                initialStatus={order.status}
                initialFinalPrice={order.final_price}
                initialInternalNotes={order.internal_notes}
              />
            </BentoSection>
          </div>
        </div>
      </div>

      {/* Right: chat — desktop fixed-width 35% column, mobile renders as fixed footer banner */}
      <aside className="md:basis-[35%] md:border-l md:h-full">
        <OrderChat
          orderId={order.id}
          currentUserId={user.id}
          initialMessages={initialMessages}
          participants={participants}
          viewer="admin"
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
