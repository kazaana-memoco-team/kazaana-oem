"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { DocumentType } from "@/lib/documents/types";

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

const saveSchema = z.object({
  type: z.enum(["quote", "invoice", "delivery", "receipt"]),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
});

export type SaveTemplateResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveEmailTemplate(
  formData: FormData,
): Promise<SaveTemplateResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "入力エラー",
    };
  }

  const key = `email.${parsed.data.type}`;
  const { error } = await auth.supabase.from("system_settings").upsert({
    key,
    value: { subject: parsed.data.subject, body: parsed.data.body },
    description: `${parsed.data.type} email template`,
    updated_by: auth.userId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/templates");
  return { ok: true };
}

export async function resetEmailTemplate(
  type: DocumentType,
): Promise<SaveTemplateResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const key = `email.${type}`;
  const { error } = await auth.supabase
    .from("system_settings")
    .delete()
    .eq("key", key);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/templates");
  return { ok: true };
}
