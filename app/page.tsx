import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col px-6 py-16">
      <header className="flex items-center justify-between">
        <div className="text-lg font-semibold">BECOS OEM</div>
        <nav className="flex gap-3">
          {user ? (
            <Link
              href="/account"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              マイページ
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                ログイン
              </Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>
                新規登録
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mt-24 space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          個人と職人をつなぐ、
          <br />
          BECOSの OEM プラットフォーム
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          色や名入れなどのカスタマイズから、ジャンルを指定したフルカスタムオーダーまで。
          職人と直接コミュニケーションを取りながら、あなただけの一品を作れます。
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/customize" className={buttonVariants({ size: "lg" })}>
            カスタマイズ商品を見る
          </Link>
          {!user ? (
            <Link
              href="/signup"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              新規登録
            </Link>
          ) : null}
          <a
            href="https://www.thebecos.com"
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost", size: "lg" })}
          >
            本店 BECOS を見る
          </a>
        </div>
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-medium">商品をカスタマイズ</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            BECOSで取り扱う商品に名入れや色変更を施し、世界に一つの逸品に。
          </p>
        </div>
        <div className="rounded-lg border p-6">
          <h2 className="text-lg font-medium">完全カスタムオーダー</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ジャンル・好み・予算を伝えると、職人が提案・製作。チャットで直接相談できます。
          </p>
        </div>
      </section>
    </main>
  );
}
