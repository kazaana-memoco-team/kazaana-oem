import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getOemProduct } from "@/lib/oem-products";
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
  const cfg = getOemProduct(handle);
  if (!cfg) notFound();

  const product = await getProductByHandle(handle);
  if (!product || product.status !== "ACTIVE") notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/customize"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        ← カスタマイズ商品一覧
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <section>
          {product.featuredImage ? (
            <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
              <Image
                src={product.featuredImage.url}
                alt={product.featuredImage.altText ?? product.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div>
          ) : null}
          {product.images.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {product.images.slice(1, 5).map((img, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                >
                  <Image
                    src={img.url}
                    alt={img.altText ?? ""}
                    fill
                    sizes="20vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section>
          <h1 className="text-2xl font-semibold tracking-tight">
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
        </section>
      </div>
    </main>
  );
}
