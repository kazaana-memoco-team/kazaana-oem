import crypto from "node:crypto";

/**
 * Verify Shopify webhook HMAC signature.
 * Shopify sends `X-Shopify-Hmac-Sha256` — base64 of HMAC-SHA256(body, secret).
 */
export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string | null,
): boolean {
  if (!hmacHeader) return false;

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
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
