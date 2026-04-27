import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { OEM_PRODUCTS } from "@/lib/oem-products";
import { getProductByHandle } from "@/lib/shopify/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Live featured OEM products (only ACTIVE shown)
  const featured = (
    await Promise.all(
      OEM_PRODUCTS.slice(0, 4).map(async (cfg) => ({
        cfg,
        shopify: await getProductByHandle(cfg.handle),
      })),
    )
  ).filter((p) => p.shopify && p.shopify.status === "ACTIVE");

  return (
    <main className="min-h-svh">
      {/* ─── Top nav ─── */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-base font-semibold tracking-wide">BECOS</span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              OEM
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/customize"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline"
            >
              商品を見る
            </Link>
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
                <Link
                  href="/signup"
                  className={buttonVariants({ size: "sm" })}
                >
                  新規登録
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-6xl px-4 py-20 md:px-8 md:py-28">
        <p className="text-[10pt] uppercase tracking-[0.3em] text-muted-foreground">
          Crafted for you
        </p>
        <h1 className="mt-4 text-4xl font-medium leading-tight tracking-tight sm:text-5xl md:text-6xl">
          職人と作る、
          <br />
          あなただけの一品。
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
          BECOS の伝統工芸品に、名入れやギフトラッピングなどの
          カスタマイズを加えてご注文いただけるOEM特別ショップ。
          職人とチャットで相談しながら、世界にひとつの逸品を作ります。
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/customize"
            className={buttonVariants({ size: "lg" })}
          >
            カスタマイズ商品を見る
          </Link>
          {!user ? (
            <Link
              href="/signup"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              はじめる（無料登録）
            </Link>
          ) : null}
        </div>
      </section>

      {/* ─── Featured products ─── */}
      {featured.length > 0 ? (
        <section className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10pt] uppercase tracking-[0.3em] text-muted-foreground">
                  Featured
                </p>
                <h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">
                  カスタマイズ可能な商品
                </h2>
              </div>
              <Link
                href="/customize"
                className="hidden text-sm text-muted-foreground underline-offset-4 hover:underline sm:inline"
              >
                すべて見る →
              </Link>
            </div>

            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map(({ cfg, shopify }) =>
                shopify ? (
                  <li key={cfg.handle}>
                    <Link
                      href={`/customize/${cfg.handle}`}
                      className="group block"
                    >
                      <div className="relative aspect-square overflow-hidden bg-muted">
                        {shopify.featuredImage ? (
                          <Image
                            src={shopify.featuredImage.url}
                            alt={shopify.featuredImage.altText ?? shopify.title}
                            fill
                            sizes="(max-width: 640px) 50vw, 25vw"
                            className="object-cover transition duration-700 group-hover:scale-105"
                          />
                        ) : null}
                      </div>
                      <p className="mt-3 text-[10pt] uppercase tracking-[0.25em] text-muted-foreground">
                        {cfg.craftsman_display_name}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-medium">
                        {shopify.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatPrice(shopify.variants[0]?.price)}〜
                      </p>
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>

            <div className="mt-10 sm:hidden">
              <Link
                href="/customize"
                className={buttonVariants({ variant: "outline" })}
              >
                すべての商品を見る
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* ─── How it works ─── */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24">
          <p className="text-[10pt] uppercase tracking-[0.3em] text-muted-foreground">
            How it works
          </p>
          <h2 className="mt-2 text-2xl font-medium tracking-tight sm:text-3xl">
            ご注文の流れ
          </h2>

          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-6">
            <Step
              n="01"
              title="商品を選ぶ"
              description="名入れや色変更ができる伝統工芸品をお選びください。"
            />
            <Step
              n="02"
              title="カスタマイズして見積もり依頼"
              description="名入れの文字、ギフトラッピング、ご要望をお伝えください。BECOS から見積もりをお返しします。"
            />
            <Step
              n="03"
              title="支払い・職人が製作・お届け"
              description="ご納得いただけたら決済へ。職人が一点ずつ製作し、お届けいたします。進行はチャットで随時ご確認いただけます。"
            />
          </ol>
        </div>
      </section>

      {/* ─── Footer CTA ─── */}
      <section className="border-t">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center md:py-20">
          <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
            まずは商品をご覧ください。
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            ご相談・ご質問はマイページのチャットからお気軽にどうぞ。
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/customize"
              className={buttonVariants({ size: "lg" })}
            >
              商品を見る
            </Link>
            <a
              href="https://www.thebecos.com"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "ghost", size: "lg" })}
            >
              本店 BECOS へ →
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <p>© BECOS OEM by 株式会社KAZAANA</p>
          <p>
            <a
              href="https://www.thebecos.com"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:underline"
            >
              www.thebecos.com
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}

function Step({
  n,
  title,
  description,
}: {
  n: string;
  title: string;
  description: string;
}) {
  return (
    <li>
      <p className="text-[10pt] tracking-[0.25em] text-muted-foreground">
        {n}
      </p>
      <h3 className="mt-2 text-lg font-medium">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </li>
  );
}

function formatPrice(price: string | undefined): string {
  if (!price) return "-";
  const num = Number(price);
  if (Number.isNaN(num)) return price;
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(num);
}
