import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">新規登録</h1>
        <p className="text-sm text-muted-foreground">
          BECOS OEM 発注プラットフォーム
        </p>
      </div>
      <div className="mt-8">
        <SignupForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        既にアカウントをお持ちの方は{" "}
        <Link className="underline underline-offset-4" href="/login">
          ログイン
        </Link>
      </p>
    </main>
  );
}
