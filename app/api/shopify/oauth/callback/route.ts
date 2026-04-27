import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * OAuth callback for Shopify install. Exchanges the code for an offline
 * access token and shows it in JSON for the user to copy into .env.local.
 *
 * NOTE: Production should NEVER expose tokens in a JSON response. This is
 * an intentional one-time helper for capturing the token during local setup.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const shop = params.get("shop");
  const state = params.get("state");
  const hmac = params.get("hmac");

  if (!code || !shop || !state || !hmac) {
    return new NextResponse(
      "Missing required params (code, shop, state, hmac)",
      { status: 400 },
    );
  }

  // 1. State check (CSRF protection)
  const cookieState = request.cookies.get("shopify_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return new NextResponse("Invalid state — possible CSRF attempt", {
      status: 400,
    });
  }

  // 2. HMAC verification of query params (Shopify guarantee)
  if (!verifyHmac(params, hmac)) {
    return new NextResponse("Invalid HMAC", { status: 400 });
  }

  // 3. Validate shop domain shape
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop)) {
    return new NextResponse("Invalid shop domain", { status: 400 });
  }

  // 4. Exchange code for offline access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    return new NextResponse(
      `Token exchange failed: ${tokenRes.status} ${text.slice(0, 500)}`,
      { status: 500 },
    );
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    scope: string;
  };

  // 5. Show token. The user will copy it into .env.local manually.
  return NextResponse.json(
    {
      success: true,
      shop,
      scope: data.scope,
      access_token: data.access_token,
      next_steps: [
        "1. Copy `access_token` into .env.local as SHOPIFY_ADMIN_API_TOKEN",
        "2. Restart `npm run dev` so env vars reload",
        "3. Close this tab and never share the access_token",
      ],
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

function verifyHmac(params: URLSearchParams, hmacFromShopify: string): boolean {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) return false;

  const message = Array.from(params.entries())
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .map(([key, value]) => [key, value] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const computed = crypto
    .createHmac("sha256", secret)
    .update(message, "utf8")
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(hmacFromShopify, "hex"),
    );
  } catch {
    return false;
  }
}
