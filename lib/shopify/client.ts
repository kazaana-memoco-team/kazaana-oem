/**
 * Shopify Admin API GraphQL client.
 *
 * Uses the storefront's Custom App admin token. Server-only — never expose
 * SHOPIFY_ADMIN_API_TOKEN to the browser.
 */

const API_VERSION = "2025-01";

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; [key: string]: unknown }>;
  extensions?: unknown;
};

export class ShopifyAdminError extends Error {
  constructor(
    message: string,
    public readonly errors?: GraphQLResponse<unknown>["errors"],
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ShopifyAdminError";
  }
}

export async function shopifyAdminFetch<TData = unknown, TVariables = Record<string, unknown>>(
  query: string,
  variables?: TVariables,
): Promise<TData> {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_API_TOKEN;

  if (!storeDomain || !adminToken) {
    throw new ShopifyAdminError(
      "Shopify env vars missing: set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_API_TOKEN",
    );
  }

  const url = `https://${storeDomain}/admin/api/${API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminToken,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ShopifyAdminError(
      `Shopify Admin API HTTP ${res.status}: ${text.slice(0, 500)}`,
      undefined,
      res.status,
    );
  }

  const json = (await res.json()) as GraphQLResponse<TData>;

  if (json.errors?.length) {
    throw new ShopifyAdminError(
      `Shopify Admin API GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`,
      json.errors,
    );
  }

  if (!json.data) {
    throw new ShopifyAdminError("Shopify Admin API returned no data");
  }

  return json.data;
}
