import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * Initiates the Shopify OAuth install flow.
 *
 * Open in browser:
 *   /api/shopify/oauth/install?shop=thebecos.myshopify.com
 *
 * (or default to SHOPIFY_STORE_DOMAIN env)
 */
export async function GET(request: NextRequest) {
  const shopParam =
    request.nextUrl.searchParams.get("shop") ??
    process.env.SHOPIFY_STORE_DOMAIN;

  if (!shopParam) {
    return new NextResponse(
      "Missing ?shop=<shop>.myshopify.com or SHOPIFY_STORE_DOMAIN env",
      { status: 400 },
    );
  }

  const shop = shopParam.endsWith(".myshopify.com")
    ? shopParam
    : `${shopParam}.myshopify.com`;

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const scopes = process.env.SHOPIFY_OAUTH_SCOPES;
  if (!clientId || !scopes) {
    return new NextResponse(
      "Missing SHOPIFY_CLIENT_ID or SHOPIFY_OAUTH_SCOPES env",
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/shopify/oauth/callback`;
  const state = crypto.randomBytes(16).toString("hex");

  const installUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  installUrl.searchParams.set("client_id", clientId);
  installUrl.searchParams.set("scope", scopes);
  installUrl.searchParams.set("redirect_uri", redirectUri);
  installUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(installUrl.toString());
  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 600,
    path: "/",
  });
  return res;
}
