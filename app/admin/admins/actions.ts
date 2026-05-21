"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getCurrentUserWithRole } from "@/lib/auth/current-user";
import { sendAdminInvite } from "@/lib/email/invite";

const schema = z.object({
  email: z.string().trim().email("メールアドレスを正しく入力してください"),
  display_name: z.string().trim().max(80).optional(),
});

export type InviteAdminResult =
  | { ok: true; inviteUrl: string; emailed: boolean }
  | { ok: false; error: string };

export async function inviteAdmin(
  _prev: InviteAdminResult | undefined,
  formData: FormData,
): Promise<InviteAdminResult> {
  // Server actions bypass the layout guard — re-verify admin.
  const me = await getCurrentUserWithRole();
  if (me.role !== "admin") {
    return { ok: false, error: "管理者権限が必要です。" };
  }

  const parsed = schema.safeParse({
    email: formData.get("email"),
    display_name: formData.get("display_name") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const svc = await createServiceRoleClient();

  // Generate an invite link (also creates the auth user)
  const { data, error } = await svc.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
    options: parsed.data.display_name
      ? { data: { display_name: parsed.data.display_name } }
      : undefined,
  });

  if (error || !data) {
    const code = error?.code;
    const msg = error?.message ?? "招待リンクの生成に失敗しました";
    if (
      code === "email_exists" ||
      code === "user_already_exists" ||
      /already|registered|exists/i.test(msg)
    ) {
      return { ok: false, error: "このメールアドレスは既に登録済みです。" };
    }
    return { ok: false, error: msg };
  }

  const invitedUserId = data.user?.id;
  const tokenHash = data.properties?.hashed_token;
  if (!invitedUserId || !tokenHash) {
    return { ok: false, error: "招待トークンの取得に失敗しました。" };
  }

  // Promote to admin (the handle_new_user trigger defaults role to customer)
  const { error: roleErr } = await svc
    .from("profiles")
    .update({
      role: "admin",
      display_name: parsed.data.display_name ?? null,
    })
    .eq("id", invitedUserId);
  if (roleErr) {
    return { ok: false, error: `role 設定に失敗: ${roleErr.message}` };
  }

  // Absolute base URL so the emailed link works; trim any trailing slash to
  // avoid a doubled "//" before the path.
  const baseUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
  ).replace(/\/+$/, "");
  const inviteUrl = `${baseUrl}/auth/confirm?token_hash=${encodeURIComponent(
    tokenHash,
  )}&type=invite&next=${encodeURIComponent("/auth/set-password")}`;

  // Send the invite email (best-effort; link is also returned for fallback)
  const emailRes = await sendAdminInvite({
    to: parsed.data.email,
    inviteUrl,
    displayName: parsed.data.display_name,
  });

  revalidatePath("/admin/admins");
  return { ok: true, inviteUrl, emailed: emailRes.ok };
}
