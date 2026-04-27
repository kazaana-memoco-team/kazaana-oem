import type { DocumentType } from "./types";

/**
 * Document number = the order's OEM number (OEM000001).
 * Same order shares the number across types; differentiation is by type.
 */
export function buildDocumentNumber(orderNumber: string): string {
  return orderNumber;
}

export const DOCUMENT_TITLE: Record<DocumentType, string> = {
  quote: "御 見 積 書",
  invoice: "御 請 求 書",
  delivery: "御 納 品 書",
  receipt: "領 収 書",
};

export const DOCUMENT_INTRO: Record<DocumentType, string> = {
  quote: "下記のとおりお見積り申し上げます。",
  invoice: "下記のとおりご請求申し上げます。",
  delivery: "下記のとおり納品いたしました。",
  receipt: "下記のとおり領収いたしました。",
};
