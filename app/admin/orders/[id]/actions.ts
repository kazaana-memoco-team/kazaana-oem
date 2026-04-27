"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/types/database";

type OrderUpdate = Database["public"]["Tables"]["orders"]["Update"];

const STATUSES = [
  "draft",
  "awaiting_quote",
  "quoted",
  "paid",
  "in_production",
  "shipped",
  "completed",
  "cancelled",
] as const;

const updateSchema = z.object({
  status: z.enum(STATUSES).optional(),
  final_price: z
    .preprocess(
      (v) => (v === "" || v === undefined || v === null ? null : v),
      z.union([z.coerce.number().int().nonnegative(), z.null()]),
    )
    .optional(),
  internal_notes: z.string().max(4000).optional(),
});

export type UpdateOrderResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "ログインが必要です。" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { ok: false as const, error: "管理者権限が必要です。" };
  }
  return { ok: true as const, supabase, userId: user.id };
}

export async function updateOrder(
  orderId: string,
  formData: FormData,
): Promise<UpdateOrderResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw = Object.fromEntries(formData);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: `入力エラー: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    };
  }

  const updates: OrderUpdate = {};
  if (parsed.data.status) updates.status = parsed.data.status;
  if (parsed.data.final_price !== undefined) {
    updates.final_price = parsed.data.final_price;
  }
  if (parsed.data.internal_notes !== undefined) {
    updates.internal_notes = parsed.data.internal_notes || null;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, error: "変更がありません。" };
  }

  const { error } = await auth.supabase
    .from("orders")
    .update(updates)
    .eq("id", orderId);

  if (error) {
    return { ok: false, error: error.message };
  }

  await auth.supabase.from("order_events").insert({
    order_id: orderId,
    actor_id: auth.userId,
    event_type: "admin_update",
    payload: updates as Json,
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}
