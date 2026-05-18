/**
 * Phase 4 — fully custom order (type = 'full_custom').
 * The customer describes what they want from scratch; BECOS coordinates
 * with a craftsman and replies with a quote through the same order flow.
 */

export const CUSTOM_ORDER_GENRES = [
  "陶磁器",
  "ガラス",
  "漆器",
  "金属・金工",
  "木工・竹工",
  "染織・布",
  "和紙",
  "その他",
] as const;

export type CustomOrderGenre = (typeof CUSTOM_ORDER_GENRES)[number];

export const CUSTOM_ORDER_BUDGETS = [
  { value: "under_10k", label: "〜1万円" },
  { value: "10k_30k", label: "1〜3万円" },
  { value: "30k_50k", label: "3〜5万円" },
  { value: "50k_100k", label: "5〜10万円" },
  { value: "100k_300k", label: "10〜30万円" },
  { value: "over_300k", label: "30万円〜" },
  { value: "undecided", label: "未定・相談したい" },
] as const;

export type CustomOrderBudget = (typeof CUSTOM_ORDER_BUDGETS)[number]["value"];

export function budgetLabel(value: string): string {
  return (
    CUSTOM_ORDER_BUDGETS.find((b) => b.value === value)?.label ?? value
  );
}

/** Shape stored in orders.customization for full_custom orders */
export type CustomOrderCustomization = {
  kind: "full_custom";
  title: string;
  genre: string;
  description: string;
  budget: string;
  desired_deadline: string | null;
  quantity: number;
};
