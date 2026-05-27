"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserWithRole } from "@/lib/auth/current-user";

const schema = z
  .object({
    password: z.string().min(8, "パスワードは8文字以上で入力してください"),
    confirm: z.string().min(8, "確認用パスワードを入力してください"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "パスワードが一致しません",
    path: ["confirm"],
  });

export type SetPasswordResult = { error?: string };

export async function setPassword(
  _prev: SetPasswordResult | undefined,
  formData: FormData,
): Promise<SetPasswordResult> {
  const me = await getCurrentUserWithRole();
  if (!me.userId) {
    return { error: "セッションが無効です。招待リンクを開き直してください。" };
  }

  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  // Send the user where they belong instead of assuming admin — keeps this
  // endpoint reusable (e.g. recovery) and avoids bouncing a non-admin off /admin.
  redirect(me.role === "admin" ? "/admin" : "/account");
}
