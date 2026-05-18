import { getOemProduct, DEFAULT_OEM_FEES } from "@/lib/oem-products";
import type { DocumentLineItem } from "@/components/documents/document-template";

type CustomizationShape = {
  product_title?: string;
  variant_title?: string;
  unit_price?: number;
  quantity?: number;
  text_engraving?: string | null;
  gift_wrap?: boolean;
  gift_message?: string | null;
  notes?: string | null;
  handle?: string;
};

export function buildLineItemsFromOrder(
  customization: unknown,
): DocumentLineItem[] {
  const c = (customization ?? {}) as CustomizationShape;
  const productTitle = c.product_title ?? "（不明な商品）";
  const variantTitle = c.variant_title ?? "";
  const unitPrice = Number(c.unit_price ?? 0);
  const quantity = Number(c.quantity ?? 1);

  // Hardcoded products have specific fees; tag-discovered products use the
  // defaults. (build-items only has the handle, not the Shopify tags.)
  const cfg = c.handle ? getOemProduct(c.handle) : null;
  const fees = cfg?.fees ?? DEFAULT_OEM_FEES;
  const engravingFee = fees.text_engraving ?? 0;
  const giftWrapFee = fees.gift_wrap ?? 0;

  const items: DocumentLineItem[] = [
    {
      description: variantTitle
        ? `${productTitle} (${variantTitle})`
        : productTitle,
      unitPrice,
      quantity,
    },
  ];

  if (c.text_engraving && engravingFee > 0) {
    items.push({
      description: `名入れ加工: ${c.text_engraving}`,
      unitPrice: engravingFee,
      quantity,
    });
  }

  if (c.gift_wrap && giftWrapFee > 0) {
    items.push({
      description: "ギフトラッピング",
      unitPrice: giftWrapFee,
      quantity: 1,
    });
  }

  return items;
}
