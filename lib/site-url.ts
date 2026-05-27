/**
 * Absolute base URL of the deployed site, with any trailing slash trimmed.
 *
 * Used by code that builds links sent over email — relative URLs render
 * unclickably in mail clients, and a trailing slash in NEXT_PUBLIC_SITE_URL
 * would yield "//path", which browsers parse as a protocol-relative URL.
 */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001").replace(
    /\/+$/,
    "",
  );
}
