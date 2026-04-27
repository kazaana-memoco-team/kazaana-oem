import Link from "next/link";
import Image from "next/image";
import { OEM_PRODUCTS } from "@/lib/oem-products";
import { getProductByHandle } from "@/lib/shopify/products";

export const dynamic = "force-dynamic";

export default async function CustomizeIndexPage() {
  const products = await Promise.all(
    OEM_PRODUCTS.map(async (cfg) => ({
      cfg,
      shopify: await getProductByHandle(cfg.handle),
    })),
  );

  const visible = products.filter(
    (p) => p.shopify && p.shopify.status === "ACTIVE",
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          カスタマイズ可能な商品
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          名入れやギフトラッピングなど、あなただけの一品にカスタマイズできる商品です。
        </p>
      </header>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">
          現在、カスタマイズ対応商品がありません。
        </p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(({ cfg, shopify }) =>
            shopify ? (
              <li key={cfg.handle} className="overflow-hidden rounded-lg border">
                <Link
                  href={`/customize/${cfg.handle}`}
                  className="group block focus:outline-none"
                >
                  {shopify.featuredImage ? (
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      <Image
                        src={shopify.featuredImage.url}
                        alt={shopify.featuredImage.altText ?? shopify.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted" />
                  )}
                  <div className="space-y-2 p-4">
                    <h2 className="line-clamp-2 text-sm font-medium">
                      {shopify.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(shopify.variants[0]?.price)}〜
                    </p>
                  </div>
                </Link>
              </li>
            ) : null,
          )}
        </ul>
      )}
    </main>
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
