"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "セッションが無効です。招待リンクを開き直してください。" };
  }

  const parsed = schema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: error.message };
  }

  // Send the user where they belong instead of assuming admin — keeps this
  // endpoint reusable (e.g. recovery) and avoids bouncing a non-admin off /admin.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  revalidatePath("/", "layout");
  redirect(profile?.role === "admin" ? "/admin" : "/account");
}
