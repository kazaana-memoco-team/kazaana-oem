import { shopifyAdminFetch, ShopifyAdminError } from "./client";

export type DraftOrderLineItemInput = {
  variantId?: string;
  title?: string;
  quantity: number;
  /** Yen amount as string (e.g. "12000") */
  originalUnitPrice?: string;
  /** Custom attributes shown in admin & email */
  customAttributes?: Array<{ key: string; value: string }>;
  requiresShipping?: boolean;
};

export type CreatedDraftOrder = {
  id: string;
  invoiceUrl: string | null;
  totalPrice: string;
  status: string;
};

/** Key used in note_attributes / customAttributes to link Shopify orders back to OEM orders */
export const OEM_ORDER_ID_ATTR_KEY = "oem_order_id";

/**
 * Create a Draft Order in Shopify with custom line items + customer email.
 * Returns invoiceUrl which the user is redirected to for checkout.
 *
 * The OEM order id is stored in the Draft Order's `customAttributes`
 * (which surfaces as `note_attributes` on the resulting Order webhook).
 * We do NOT use tags because Shopify caps each tag at 40 chars and a UUID
 * with a prefix exceeds that.
 */
export async function createDraftOrder(input: {
  email: string;
  lineItems: DraftOrderLineItemInput[];
  note?: string;
  /** Internal OEM order id, stored as a Draft Order custom attribute */
  oemOrderId: string;
}): Promise<CreatedDraftOrder> {
  const mutation = `
    mutation DraftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          invoiceUrl
          totalPrice
          status
        }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    input: {
      email: input.email,
      note: input.note,
      customAttributes: [
        { key: OEM_ORDER_ID_ATTR_KEY, value: input.oemOrderId },
      ],
      lineItems: input.lineItems.map((li) => ({
        variantId: li.variantId,
        title: li.title,
        quantity: li.quantity,
        originalUnitPrice: li.originalUnitPrice,
        customAttributes: li.customAttributes,
        requiresShipping: li.requiresShipping ?? true,
      })),
    },
  };

  const data = await shopifyAdminFetch<{
    draftOrderCreate: {
      draftOrder: CreatedDraftOrder | null;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(mutation, variables);

  if (data.draftOrderCreate.userErrors.length) {
    throw new ShopifyAdminError(
      `Draft order create userErrors: ${data.draftOrderCreate.userErrors
        .map((e) => `${e.field?.join(".") ?? ""}:${e.message}`)
        .join("; ")}`,
    );
  }

  if (!data.draftOrderCreate.draftOrder) {
    throw new ShopifyAdminError("Draft order returned null");
  }

  return data.draftOrderCreate.draftOrder;
}
