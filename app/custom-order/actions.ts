"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { CUSTOM_ORDER_GENRES, CUSTOM_ORDER_BUDGETS } from "@/lib/custom-order";

const genreValues: readonly string[] = CUSTOM_ORDER_GENRES;
const budgetValues: readonly string[] = CUSTOM_ORDER_BUDGETS.map(
  (b) => b.value,
);

const schema = z.object({
  title: z.string().trim().min(1, "件名を入力してください").max(120),
  genre: z.string().refine((v) => genreValues.includes(v), "ジャンルを選択してください"),
  description: z
    .string()
    .trim()
    .min(10, "ご要望を10文字以上で入力してください")
    .max(4000),
  budget: z.string().refine((v) => budgetValues.includes(v), "予算を選択してください"),
  desired_deadline: z.string().max(40).optional(),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  // JSON-encoded array of uploaded image URLs
  reference_images: z.string().optional(),
});

export type SubmitCustomOrderResult = {
  error?: string;
};

export async function submitCustomOrder(
  _prev: SubmitCustomOrderResult | undefined,
  formData: FormData,
): Promise<SubmitCustomOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "ログインが必要です。" };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  let referenceImages: string[] = [];
  if (parsed.data.reference_images) {
    try {
      const arr = JSON.parse(parsed.data.reference_images);
      if (Array.isArray(arr)) {
        referenceImages = arr.filter((v): v is string => typeof v === "string");
      }
    } catch {
      // ignore malformed input — treat as no images
    }
  }

  const { data: inserted, error } = await supabase
    .from("orders")
    .insert({
      customer_id: user.id,
      type: "full_custom",
      status: "awaiting_quote",
      reference_images: referenceImages,
      customization: {
        kind: "full_custom",
        title: parsed.data.title,
        genre: parsed.data.genre,
        description: parsed.data.description,
        budget: parsed.data.budget,
        desired_deadline: parsed.data.desired_deadline || null,
        quantity: parsed.data.quantity,
      },
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return {
      error: `送信に失敗しました: ${error?.message ?? "unknown"}`,
    };
  }

  await supabase.from("order_events").insert({
    order_id: inserted.id,
    actor_id: user.id,
    event_type: "custom_order_submitted",
    payload: { genre: parsed.data.genre, budget: parsed.data.budget },
  });

  revalidatePath("/account");
  redirect(`/account/orders/${inserted.id}`);
}
