import Link from "next/link";
import Image from "next/image";
import { OEM_PRODUCTS, OEM_PRODUCT_TAG } from "@/lib/oem-products";
import {
  getProductByHandle,
  getProductsByTag,
  type ShopifyProduct,
} from "@/lib/shopify/products";

export const dynamic = "force-dynamic";

export default async function CustomizeIndexPage() {
  // 1) Hardcoded OEM products
  const hardcoded = await Promise.all(
    OEM_PRODUCTS.map((cfg) => getProductByHandle(cfg.handle)),
  );

  // 2) Tag-discovered OEM products
  let tagged: ShopifyProduct[] = [];
  try {
    tagged = await getProductsByTag(OEM_PRODUCT_TAG);
  } catch {
    // Non-fatal — fall back to hardcoded only
  }

  // Merge + dedupe by handle, keep only ACTIVE
  const byHandle = new Map<string, ShopifyProduct>();
  for (const p of [...hardcoded, ...tagged]) {
    if (p && p.status === "ACTIVE") byHandle.set(p.handle, p);
  }
  const visible = Array.from(byHandle.values());

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← トップ
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
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
          {visible.map((shopify) => (
            <li
              key={shopify.handle}
              className="overflow-hidden rounded-lg border"
            >
              <Link
                href={`/customize/${shopify.handle}`}
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
          ))}
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
