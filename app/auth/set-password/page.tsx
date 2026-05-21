import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=session_required");
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">パスワードを設定</h1>
        <p className="text-sm text-muted-foreground">
          BECOS OEM 管理者アカウント（{user.email}）
        </p>
      </div>
      <div className="mt-8">
        <SetPasswordForm />
      </div>
    </main>
  );
}
