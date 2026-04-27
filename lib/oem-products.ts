/**
 * OEM-eligible product registry.
 *
 * Phase 1 (MVP): hardcoded list of Shopify product handles + per-product
 * customization config. Future: move this to a Shopify metafield or admin DB.
 */

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

export function getOemProduct(handle: string): OemProductConfig | null {
  return OEM_PRODUCTS.find((p) => p.handle === handle) ?? null;
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
