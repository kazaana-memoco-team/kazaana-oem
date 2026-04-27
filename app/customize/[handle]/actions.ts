"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  computeEstimatedTotal,
  getOemProduct,
  type CustomizationValues,
} from "@/lib/oem-products";
import { getProductByHandle } from "@/lib/shopify/products";

const formSchema = z.object({
  variant_id: z.string().min(1),
  variant_title: z.string().min(1),
  unit_price: z.coerce.number().int().nonnegative(),
  quantity: z.coerce.number().int().min(1).max(50),
  text_engraving: z.string().max(40).optional(),
  gift_message: z.string().max(200).optional(),
  gift_wrap: z
    .union([z.literal("on"), z.literal("true"), z.string()])
    .optional(),
  notes: z.string().max(2000).optional(),
});

export type SubmitResult = {
  error?: string;
  orderId?: string;
};

export async function submitCustomization(
  handle: string,
  formData: FormData,
): Promise<SubmitResult> {
  const cfg = getOemProduct(handle);
  if (!cfg) return { error: "対応していない商品です。" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ログインが必要です。" };

  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "入力内容を確認してください。" };
  }

  // Re-fetch product server-side to verify variant + price (anti-tamper)
  const product = await getProductByHandle(handle);
  if (!product || product.status !== "ACTIVE") {
    return { error: "現在この商品はカスタマイズできません。" };
  }

  const variant = product.variants.find(
    (v) => v.id === parsed.data.variant_id,
  );
  if (!variant) {
    return { error: "選択されたバリアントが見つかりません。" };
  }
  if (!variant.availableForSale) {
    return { error: "選択されたバリアントは在庫切れです。" };
  }

  const giftWrap =
    parsed.data.gift_wrap !== undefined && parsed.data.gift_wrap !== "";

  const values: CustomizationValues = {
    variant_id: variant.id,
    variant_title: variant.title,
    unit_price: Number(variant.price),
    quantity: parsed.data.quantity,
    text_engraving: parsed.data.text_engraving || undefined,
    gift_message: parsed.data.gift_message || undefined,
    gift_wrap: giftWrap || undefined,
    notes: parsed.data.notes || undefined,
  };

  // Validate text_engraving length against per-product config
  const textCfg = cfg.customizations.find((c) => c.kind === "text_engraving");
  if (
    textCfg &&
    values.text_engraving &&
    values.text_engraving.length > textCfg.maxLength
  ) {
    return {
      error: `名入れは最大${textCfg.maxLength}文字までです。`,
    };
  }

  const estimated = computeEstimatedTotal(cfg, values);

  // Note: craftsmen are NOT users on the platform — BECOS staff coordinates
  // with them externally. We just record the craftsman label on the order
  // so admin knows which workshop is making the product.
  const { data: inserted, error: insertError } = await supabase
    .from("orders")
    .insert({
      customer_id: user.id,
      type: "product_customize",
      status: "awaiting_quote",
      shopify_product_id: product.id,
      shopify_variant_id: variant.id,
      customization: {
        handle,
        product_title: product.title,
        product_image_url: product.featuredImage?.url ?? null,
        product_image_alt: product.featuredImage?.altText ?? null,
        variant_title: variant.title,
        unit_price: Number(variant.price),
        quantity: values.quantity,
        text_engraving: values.text_engraving ?? null,
        gift_message: values.gift_message ?? null,
        gift_wrap: !!values.gift_wrap,
        notes: values.notes ?? null,
        craftsman_display_name: cfg.craftsman_display_name,
      },
      estimated_price: estimated,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      error: `注文の保存に失敗しました: ${insertError?.message ?? "unknown"}`,
    };
  }

  await supabase.from("order_events").insert({
    order_id: inserted.id,
    actor_id: user.id,
    event_type: "customization_submitted",
    payload: { handle, estimated_total: estimated },
  });

  revalidatePath("/account");
  redirect(`/account/orders/${inserted.id}`);
}
