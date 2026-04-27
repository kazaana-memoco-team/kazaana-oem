import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-12">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">ログイン</h1>
        <p className="text-sm text-muted-foreground">
          BECOS OEM 発注プラットフォーム
        </p>
      </div>
      <div className="mt-8">
        <LoginForm redirectTo={redirect} />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        アカウント未登録の方は{" "}
        <Link className="underline underline-offset-4" href="/signup">
          新規登録
        </Link>
      </p>
    </main>
  );
}
