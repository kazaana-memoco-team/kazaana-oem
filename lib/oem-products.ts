/**
 * OEM-eligible product registry.
 *
 * Two ways a Shopify product becomes OEM-customizable:
 *  1. Hardcoded in OEM_PRODUCTS below (for products needing specific
 *     customization labels / fees).
 *  2. Tagged with OEM_PRODUCT_TAG in Shopify Admin — picked up automatically
 *     and given DEFAULT_OEM_CUSTOMIZATIONS / DEFAULT_OEM_FEES.
 *
 * This lets BECOS add new OEM products by just tagging them in Shopify,
 * with no code change.
 */

/** Shopify tag that flags a product as OEM-customizable. */
export const OEM_PRODUCT_TAG = "oem-customize";

export type CustomizationField =
  | { kind: "text_engraving"; label: string; maxLength: number; required?: boolean }
  | { kind: "gift_message"; label: string; maxLength: number }
  | { kind: "gift_wrap"; label: string }
  | { kind: "notes"; label: string };

export type OemProductConfig = {
  handle: string;
  /**
   * Display name of the craftsman / workshop that makes this product.
   * On order submission, the system tries to find a craftsman profile
   * with this display_name and auto-assigns the order to them.
   * Admin can override the assignment afterwards.
   */
  craftsman_display_name: string;
  /** Customizations enabled for this product */
  customizations: CustomizationField[];
  /**
   * Estimated additional fee per customization type (JPY).
   * Phase 1 keeps it simple — the final price is computed server-side at
   * order submission and re-confirmed when creating the Shopify Draft Order.
   */
  fees: {
    text_engraving?: number;
    gift_wrap?: number;
  };
};

export const OEM_PRODUCTS: OemProductConfig[] = [
  {
    handle: "s0111-004",
    craftsman_display_name: "丸モ高木陶器",
    customizations: [
      { kind: "text_engraving", label: "名入れ（最大10文字）", maxLength: 10 },
      { kind: "gift_message", label: "ギフトメッセージ", maxLength: 50 },
      { kind: "gift_wrap", label: "ギフトラッピング" },
      { kind: "notes", label: "備考・特記事項" },
    ],
    fees: {
      text_engraving: 1000,
      gift_wrap: 500,
    },
  },
  {
    handle: "s0216-001",
    craftsman_display_name: "井助商店",
    customizations: [
      { kind: "text_engraving", label: "名入れ（裏面・最大8文字）", maxLength: 8 },
      { kind: "gift_message", label: "ギフトメッセージ", maxLength: 50 },
      { kind: "gift_wrap", label: "ギフトラッピング" },
      { kind: "notes", label: "備考・特記事項" },
    ],
    fees: {
      text_engraving: 800,
      gift_wrap: 500,
    },
  },
];

/** Customizations applied to tag-discovered OEM products (no hardcoded entry). */
export const DEFAULT_OEM_CUSTOMIZATIONS: CustomizationField[] = [
  { kind: "text_engraving", label: "名入れ（最大10文字）", maxLength: 10 },
  { kind: "gift_message", label: "ギフトメッセージ", maxLength: 50 },
  { kind: "gift_wrap", label: "ギフトラッピング" },
  { kind: "notes", label: "備考・特記事項" },
];

export const DEFAULT_OEM_FEES = {
  text_engraving: 1000,
  gift_wrap: 500,
};

/** Hardcoded config lookup only. */
export function getOemProduct(handle: string): OemProductConfig | null {
  return OEM_PRODUCTS.find((p) => p.handle === handle) ?? null;
}

export function isHardcodedOemProduct(handle: string): boolean {
  return OEM_PRODUCTS.some((p) => p.handle === handle);
}

/**
 * Resolve the customization config for a product. Uses the hardcoded entry
 * if present, otherwise builds a default config from the Shopify product
 * (vendor → craftsman name). Returns null if the product is neither
 * hardcoded nor tagged as OEM.
 */
export function resolveOemConfig(args: {
  handle: string;
  vendor?: string | null;
  tags?: string[];
}): OemProductConfig | null {
  const hardcoded = getOemProduct(args.handle);
  if (hardcoded) return hardcoded;

  if (args.tags?.includes(OEM_PRODUCT_TAG)) {
    return {
      handle: args.handle,
      craftsman_display_name: args.vendor?.trim() || "BECOS提携工房",
      customizations: DEFAULT_OEM_CUSTOMIZATIONS,
      fees: DEFAULT_OEM_FEES,
    };
  }
  return null;
}

export type CustomizationValues = {
  variant_id: string;
  variant_title: string;
  unit_price: number;
  quantity: number;
  text_engraving?: string;
  gift_message?: string;
  gift_wrap?: boolean;
  notes?: string;
};

/**
 * Compute estimated total. Server is the source of truth; client may show
 * a preview using the same function for UX consistency.
 */
export function computeEstimatedTotal(
  config: OemProductConfig,
  values: CustomizationValues,
): number {
  const base = values.unit_price * values.quantity;
  let extras = 0;
  if (values.text_engraving && values.text_engraving.length > 0) {
    extras += (config.fees.text_engraving ?? 0) * values.quantity;
  }
  if (values.gift_wrap) {
    extras += config.fees.gift_wrap ?? 0;
  }
  return base + extras;
}
