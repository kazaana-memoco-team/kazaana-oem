export type DocumentType = "quote" | "invoice" | "delivery" | "receipt";

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  quote: "見積書",
  invoice: "請求書",
  delivery: "納品書",
  receipt: "領収書",
};

/** Drive subfolder name (under the shared root folder) for each type. */
export const DOCUMENT_DRIVE_FOLDER: Record<DocumentType, string> = {
  quote: "見積書",
  invoice: "請求書",
  delivery: "納品書",
  receipt: "領収書",
};

export type IssuedDocument = {
  id: string;
  order_id: string;
  type: DocumentType;
  document_number: string;
  amount: number | null;
  notes: string | null;
  issued_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
