import crypto from "node:crypto";

/**
 * Verify Shopify webhook HMAC signature.
 * Shopify sends `X-Shopify-Hmac-Sha256` — base64 of HMAC-SHA256(body, secret).
 *
 * Webhooks registered via the app config (shopify.app.toml subscriptions)
 * are signed with the app's API secret key (client secret). Webhooks
 * created manually in the Shopify Admin get a dedicated signing secret.
 * We accept SHOPIFY_WEBHOOK_SECRET if set, otherwise fall back to the
 * client secret so app-config webhooks verify without extra setup.
 */
export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string | null,
): boolean {
  if (!hmacHeader) return false;

  const secret =
    process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) return false;

  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(hmacHeader),
    );
  } catch {
    return false;
  }
}
