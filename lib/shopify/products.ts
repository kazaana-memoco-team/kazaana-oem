import { shopifyAdminFetch } from "./client";

export type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  status: string;
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
