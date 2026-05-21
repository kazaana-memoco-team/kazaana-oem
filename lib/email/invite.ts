import { sendEmail } from "./send";
import { ISSUER } from "@/lib/documents/issuer";

export async function sendAdminInvite(args: {
  to: string;
  inviteUrl: string;
  displayName?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const name = args.displayName?.trim() || "ご担当者";
  const res = await sendEmail({
    to: args.to,
    subject: "【BECOS OEM】管理者アカウントへの招待",
    body: `${name} 様

BECOS OEM 管理画面の管理者としてご招待します。
下記のリンクからパスワードを設定すると、管理者としてログインできます。

${args.inviteUrl}

※ このリンクには有効期限があります。期限切れの場合は、招待元の管理者に再送をご依頼ください。
※ 心当たりのない場合はこのメールを破棄してください。

${ISSUER.company}`,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
