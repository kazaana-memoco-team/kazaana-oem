import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DocumentTemplate } from "@/components/documents/document-template";
import { DocumentActions } from "./document-actions";
import { DOCUMENT_TYPE_LABEL } from "@/lib/documents/types";
import { buildLineItemsFromOrder } from "@/lib/documents/build-items";

export const dynamic = "force-dynamic";

type CustomizationShape = {
  product_title?: string;
  handle?: string;
};

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/documents/${id}`);

  const { data: doc, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !doc) notFound();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("id", doc.order_id)
    .maybeSingle();
  if (!order) notFound();

  const { data: customer } = await supabase
    .from("profiles")
    .select("display_name, contact_info")
    .eq("id", order.customer_id)
    .maybeSingle();

  const customization = (order.customization ?? {}) as CustomizationShape;
  const productTitle = customization.product_title ?? "（不明な商品）";

  // Single source of truth for line items (reflects final_price adjustment).
  const items = buildLineItemsFromOrder(order.customization, order.final_price);

  const recipientName = customer?.display_name ?? "ご注文者様";
  const looksLikeCompany = /(株式会社|有限会社|合同会社|合資会社|御中)/.test(
    recipientName,
  );
  const finalRecipientName = looksLikeCompany
    ? recipientName.replace(/\s*御中\s*$/, "") + " 御中"
    : `${recipientName} 様`;

  const metaLines: Array<{ label: string; value: string }> = [];
  if (doc.type === "quote") {
    metaLines.push({ label: "有効期限", value: "発行日より1ヶ月" });
  }
  if (doc.type === "invoice") {
    metaLines.push({
      label: "お支払期限",
      value: addDays(doc.created_at, 30),
    });
  }
  if (doc.type === "delivery") {
    metaLines.push({ label: "納品日", value: formatYmd(doc.created_at) });
  }
  if (doc.type === "receipt") {
    metaLines.push({ label: "但し書き", value: `${productTitle} の代金として` });
  }

  return (
    <div className="document-host bg-zinc-100 print:bg-white">
      {/* On-screen action bar (hidden when printing) */}
      <div className="document-toolbar mx-auto flex max-w-[210mm] items-center justify-between p-4 print:hidden">
        <Link
          href={`/account/orders/${order.id}`}
          className="text-sm text-zinc-500 underline-offset-4 hover:underline"
        >
          ← 注文に戻る
        </Link>
        <div className="text-xs text-zinc-500">
          {DOCUMENT_TYPE_LABEL[doc.type]} ・ {doc.document_number}
        </div>
        <DocumentActions />
      </div>

      <div className="mx-auto max-w-[210mm] bg-white shadow-sm print:shadow-none">
        <DocumentTemplate
          type={doc.type}
          documentNumber={doc.document_number}
          issuedAt={doc.created_at}
          recipientName={finalRecipientName}
          intro={null}
          items={items}
          shipping={0}
          notes={(doc.notes as string | null) ?? null}
          metaLines={metaLines}
        />
      </div>
    </div>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return formatYmd(d.toISOString());
}

function formatYmd(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
