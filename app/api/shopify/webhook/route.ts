import { NextResponse, type NextRequest } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify/webhooks";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { OEM_ORDER_ID_ATTR_KEY } from "@/lib/shopify/draft-orders";
import { issueDocumentWithNotifications } from "@/lib/documents/issue";
import type { DocumentType } from "@/lib/documents/types";

export const dynamic = "force-dynamic";

type ShopifyNoteAttribute = { name: string; value: string };

type ShopifyOrderPayload = {
  id: number;
  name: string;
  email: string | null;
  financial_status: string;
  tags?: string;
  note_attributes?: ShopifyNoteAttribute[];
  line_items?: unknown[];
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const topic = request.headers.get("x-shopify-topic");

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: ShopifyOrderPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const oemOrderId =
    extractOemOrderIdFromAttributes(payload.note_attributes) ??
    extractOemOrderIdFromTags(payload.tags ?? "");
  if (!oemOrderId) {
    // Not an OEM order — acknowledge so Shopify stops retrying.
    return NextResponse.json({ ignored: true });
  }

  const supabase = await createServiceRoleClient();

  if (topic === "orders/paid" || topic === "orders/create") {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "paid",
        shopify_order_id: String(payload.id),
      })
      .eq("id", oemOrderId);

    if (error) {
      console.error("[shopify-webhook] update order failed", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("order_events").insert({
      order_id: oemOrderId,
      actor_id: null,
      event_type: "shopify_paid",
      payload: { shopify_order_id: payload.id, name: payload.name },
    });

    // Auto-issue 請求書 / 納品書 / 領収書 once payment is confirmed.
    // 見積書 stays manual (admin sends it before checkout).
    await autoIssueOnPaid(supabase, oemOrderId);
  }

  return NextResponse.json({ ok: true });
}

async function autoIssueOnPaid(
  supabase: Awaited<ReturnType<typeof createServiceRoleClient>>,
  oemOrderId: string,
) {
  const types: DocumentType[] = ["invoice", "delivery", "receipt"];
  for (const type of types) {
    const result = await issueDocumentWithNotifications({
      supabase,
      orderId: oemOrderId,
      type,
    });
    if (result.error && result.error !== "already issued") {
      console.error(`[webhook] auto-issue ${type} failed`, result.error);
    }
  }
}

function extractOemOrderIdFromAttributes(
  attrs: ShopifyNoteAttribute[] | undefined,
): string | null {
  if (!attrs?.length) return null;
  const found = attrs.find((a) => a.name === OEM_ORDER_ID_ATTR_KEY);
  return found?.value ?? null;
}

function extractOemOrderIdFromTags(tags: string): string | null {
  // Legacy fallback for any orders created before we switched to note_attributes
  const match = tags
    .split(",")
    .map((t) => t.trim())
    .find((t) => t.startsWith("oem_order:"));
  return match ? match.slice("oem_order:".length) : null;
}
