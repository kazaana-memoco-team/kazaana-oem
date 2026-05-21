import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { resolveOemConfig } from "@/lib/oem-products";
import { getProductByHandle } from "@/lib/shopify/products";
import { CustomizeForm } from "./customize-form";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CustomizeDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const product = await getProductByHandle(handle);
  if (!product || product.status !== "ACTIVE") notFound();

  const cfg = resolveOemConfig({
    handle,
    vendor: product.vendor,
    tags: product.tags,
  });
  if (!cfg) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="md:grid md:h-screen md:grid-cols-2 md:overflow-hidden">
      {/* Left: full-height product image (stacks above content on mobile) */}
      <section className="relative h-[45vh] bg-muted md:h-screen">
        {product.featuredImage ? (
          <Image
            src={product.featuredImage.url}
            alt={product.featuredImage.altText ?? product.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            priority
          />
        ) : null}
        {product.images.length > 1 ? (
          <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/50 to-transparent p-3">
            {product.images.slice(1, 5).map((img, i) => (
              <div
                key={i}
                className="relative size-16 shrink-0 overflow-hidden rounded-md border border-white/40 bg-muted"
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? ""}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {/* Right: scrollable content column */}
      <section className="md:h-screen md:overflow-y-auto">
        <div className="mx-auto w-full max-w-lg px-4 py-8 md:px-10 md:py-12">
          <Link
            href="/customize"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← カスタマイズ商品一覧
          </Link>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight">
            {product.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            BECOSが取り扱う伝統工芸品。OEMとしてカスタマイズ可能です。
          </p>

          <div className="mt-8">
            {user ? (
              <CustomizeForm
                handle={handle}
                cfg={cfg}
                variants={product.variants.map((v) => ({
                  id: v.id,
                  title: v.title,
                  price: v.price,
                  available: v.availableForSale,
                }))}
              />
            ) : (
              <div className="rounded-lg border p-6">
                <p className="text-sm">
                  カスタマイズして注文するにはログインが必要です。
                </p>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/login?redirect=/customize/${handle}`}
                    className="text-sm underline underline-offset-4"
                  >
                    ログイン
                  </Link>
                  <Link
                    href="/signup"
                    className="text-sm underline underline-offset-4"
                  >
                    新規登録
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
