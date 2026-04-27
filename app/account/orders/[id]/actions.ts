"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createDraftOrder,
  type DraftOrderLineItemInput,
} from "@/lib/shopify/draft-orders";
import { getOemProduct, computeEstimatedTotal } from "@/lib/oem-products";
import { getProductByHandle } from "@/lib/shopify/products";

const messageSchema = z.object({
  body: z.string().trim().min(1, "メッセージを入力してください").max(4000),
});

export type SenderContext = "customer" | "admin";

export type SendMessageResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendMessage(
  orderId: string,
  formData: FormData,
  context: SenderContext = "customer",
): Promise<SendMessageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です。" };

  // If sending as admin, verify the caller is actually an admin.
  if (context === "admin") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role !== "admin") {
      return { ok: false, error: "管理者として送信する権限がありません。" };
    }
  }

  const parsed = messageSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const { error } = await supabase.from("messages").insert({
    order_id: orderId,
    sender_id: user.id,
    body: parsed.data.body,
    sender_context: context,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true };
}

export async function deleteMessage(
  messageId: string,
): Promise<SendMessageResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です。" };

  // RLS will additionally enforce sender = self OR admin role.
  const { error, data } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .select("id, order_id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "削除する権限がないか、すでに削除されています。" };
  }

  revalidatePath(`/account/orders/${data[0].order_id}`);
  revalidatePath(`/admin/orders/${data[0].order_id}`);
  return { ok: true };
}

export type ProceedToCheckoutResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

export async function proceedToCheckout(
  orderId: string,
): Promise<ProceedToCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です。" };

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return { ok: false, error: "注文が見つかりません。" };
  }
  if (order.customer_id !== user.id) {
    return { ok: false, error: "この注文を操作する権限がありません。" };
  }
  if (order.status !== "awaiting_quote" && order.status !== "quoted") {
    return {
      ok: false,
      error: `この注文は決済に進めません（status: ${order.status}）。`,
    };
  }
  if (order.checkout_url) {
    // Existing Draft Order — reuse checkout URL
    return { ok: true, checkoutUrl: order.checkout_url };
  }

  const customization = order.customization as Record<string, unknown>;
  const handle = customization.handle as string | undefined;
  if (!handle) return { ok: false, error: "商品ハンドルが見つかりません。" };

  const cfg = getOemProduct(handle);
  if (!cfg) return { ok: false, error: "対応していない商品です。" };

  const product = await getProductByHandle(handle);
  if (!product) return { ok: false, error: "Shopify商品が取得できません。" };

  const variant = product.variants.find(
    (v) => v.id === order.shopify_variant_id,
  );
  if (!variant) return { ok: false, error: "バリアントが見つかりません。" };

  const quantity = (customization.quantity as number) ?? 1;
  const textEngraving = (customization.text_engraving as string | null) ?? null;
  const giftMessage = (customization.gift_message as string | null) ?? null;
  const giftWrap = (customization.gift_wrap as boolean) ?? false;
  const notes = (customization.notes as string | null) ?? null;

  // Recompute server-side total (anti-tamper)
  const total = computeEstimatedTotal(cfg, {
    variant_id: variant.id,
    variant_title: variant.title,
    unit_price: Number(variant.price),
    quantity,
    text_engraving: textEngraving ?? undefined,
    gift_message: giftMessage ?? undefined,
    gift_wrap: giftWrap || undefined,
    notes: notes ?? undefined,
  });

  // Build line items for Draft Order
  const customAttributes: Array<{ key: string; value: string }> = [];
  if (textEngraving) customAttributes.push({ key: "名入れ", value: textEngraving });
  if (giftMessage) customAttributes.push({ key: "ギフトメッセージ", value: giftMessage });
  if (notes) customAttributes.push({ key: "備考", value: notes });

  const lineItems: DraftOrderLineItemInput[] = [
    {
      variantId: variant.id,
      quantity,
      customAttributes,
    },
  ];

  // Add customization fees as separate line items so they're visible on receipt
  const engravingFee = cfg.fees.text_engraving ?? 0;
  if (textEngraving && engravingFee > 0) {
    lineItems.push({
      title: `名入れ加工（${variant.title}）`,
      quantity,
      originalUnitPrice: String(engravingFee),
      requiresShipping: false,
      customAttributes: [{ key: "名入れ", value: textEngraving }],
    });
  }
  if (giftWrap && (cfg.fees.gift_wrap ?? 0) > 0) {
    lineItems.push({
      title: "ギフトラッピング",
      quantity: 1,
      originalUnitPrice: String(cfg.fees.gift_wrap),
      requiresShipping: false,
      customAttributes: [],
    });
  }

  const customerEmail = user.email;
  if (!customerEmail) {
    return { ok: false, error: "ユーザーのメールアドレスが取得できません。" };
  }

  let draft;
  try {
    draft = await createDraftOrder({
      email: customerEmail,
      lineItems,
      note: `OEM注文 ${orderId}\n商品: ${customization.product_title}\n${
        textEngraving ? `名入れ: ${textEngraving}\n` : ""
      }${giftMessage ? `メッセージ: ${giftMessage}\n` : ""}${
        notes ? `備考: ${notes}` : ""
      }`,
      oemOrderId: orderId,
    });
  } catch (e) {
    return {
      ok: false,
      error: `Draft Order作成に失敗しました: ${(e as Error).message}`,
    };
  }

  if (!draft.invoiceUrl) {
    return { ok: false, error: "Checkout URLが発行されませんでした。" };
  }

  // Save Draft Order info + computed total
  await supabase
    .from("orders")
    .update({
      shopify_draft_order_id: draft.id,
      checkout_url: draft.invoiceUrl,
      estimated_price: total,
    })
    .eq("id", orderId);

  await supabase.from("order_events").insert({
    order_id: orderId,
    actor_id: user.id,
    event_type: "draft_order_created",
    payload: {
      shopify_draft_order_id: draft.id,
      total_price: draft.totalPrice,
    },
  });

  revalidatePath(`/account/orders/${orderId}`);
  return { ok: true, checkoutUrl: draft.invoiceUrl };
}

export async function proceedToCheckoutAndRedirect(orderId: string) {
  const result = await proceedToCheckout(orderId);
  if (!result.ok) {
    throw new Error(result.error);
  }
  redirect(result.checkoutUrl);
}
