import { shopifyAdminFetch } from "./client";

export type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  vendor: string;
  tags: string[];
  featuredImage: { url: string; altText: string | null } | null;
  images: Array<{ url: string; altText: string | null }>;
  variants: Array<{
    id: string;
    title: string;
    price: string;
    sku: string | null;
    availableForSale: boolean;
  }>;
  options: Array<{ name: string; values: string[] }>;
};

const PRODUCT_FIELDS = `
  id
  handle
  title
  description
  status
  vendor
  tags
  featuredImage { url altText }
  images(first: 10) { nodes { url altText } }
  variants(first: 50) {
    nodes {
      id
      title
      price
      sku
      availableForSale
    }
  }
  options { name values }
`;

type RawProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  vendor: string;
  tags: string[];
  featuredImage: { url: string; altText: string | null } | null;
  images: { nodes: Array<{ url: string; altText: string | null }> };
  variants: {
    nodes: Array<{
      id: string;
      title: string;
      price: string;
      sku: string | null;
      availableForSale: boolean;
    }>;
  };
  options: Array<{ name: string; values: string[] }>;
};

function flattenProduct(p: RawProduct): ShopifyProduct {
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    description: p.description,
    status: p.status,
    vendor: p.vendor,
    tags: p.tags,
    featuredImage: p.featuredImage,
    images: p.images.nodes,
    variants: p.variants.nodes,
    options: p.options,
  };
}

export async function getProductByHandle(
  handle: string,
): Promise<ShopifyProduct | null> {
  const query = `
    query GetProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        ${PRODUCT_FIELDS}
      }
    }
  `;
  const data = await shopifyAdminFetch<{ productByHandle: RawProduct | null }>(
    query,
    { handle },
  );
  return data.productByHandle ? flattenProduct(data.productByHandle) : null;
}

/**
 * List ACTIVE products carrying a given tag (used for OEM-eligible products
 * discovered via a Shopify tag instead of being hardcoded).
 */
export async function getProductsByTag(
  tag: string,
  limit = 50,
): Promise<ShopifyProduct[]> {
  const query = `
    query GetProductsByTag($q: String!, $limit: Int!) {
      products(first: $limit, query: $q) {
        nodes {
          ${PRODUCT_FIELDS}
        }
      }
    }
  `;
  const data = await shopifyAdminFetch<{ products: { nodes: RawProduct[] } }>(
    query,
    { q: `tag:'${tag}' status:active`, limit },
  );
  return data.products.nodes.map(flattenProduct);
}

export async function getProductById(
  id: string,
): Promise<ShopifyProduct | null> {
  const query = `
    query GetProductById($id: ID!) {
      product(id: $id) {
        ${PRODUCT_FIELDS}
      }
    }
  `;
  const data = await shopifyAdminFetch<{ product: RawProduct | null }>(query, {
    id,
  });
  return data.product ? flattenProduct(data.product) : null;
}
