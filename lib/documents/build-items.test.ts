import { describe, it, expect } from "vitest";
import { buildLineItemsFromOrder } from "./build-items";

// handle なし -> DEFAULT_OEM_FEES。名入れ/ギフトなしなので商品1行のみ。
// subtotal = 10000 * 100 = 1,000,000
const baseCustomization = {
  product_title: "南部鉄器 急須",
  variant_title: "黒",
  unit_price: 10000,
  quantity: 100,
};

function total(items: { unitPrice: number; quantity: number }[]): number {
  return items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
}

describe("buildLineItemsFromOrder", () => {
  it("finalPrice 省略時は調整行を付けない（従来挙動）", () => {
    const items = buildLineItemsFromOrder(baseCustomization);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ unitPrice: 10000, quantity: 100 });
    expect(items.some((i) => i.description === "調整")).toBe(false);
  });

  it("finalPrice が小計と一致するときは調整行なし", () => {
    const items = buildLineItemsFromOrder(baseCustomization, 1_000_000);
    expect(items.some((i) => i.description === "調整")).toBe(false);
    expect(total(items)).toBe(1_000_000);
  });

  it("finalPrice が小計より低いとき、負の調整行で合計が一致", () => {
    const items = buildLineItemsFromOrder(baseCustomization, 950_000);
    const adj = items.find((i) => i.description === "調整");
    expect(adj).toMatchObject({ unitPrice: -50_000, quantity: 1 });
    expect(total(items)).toBe(950_000);
  });

  it("finalPrice が小計より高いとき、正の調整行で合計が一致", () => {
    const items = buildLineItemsFromOrder(baseCustomization, 1_050_000);
    const adj = items.find((i) => i.description === "調整");
    expect(adj).toMatchObject({ unitPrice: 50_000, quantity: 1 });
    expect(total(items)).toBe(1_050_000);
  });

  it("finalPrice が null のときは調整行なし", () => {
    const items = buildLineItemsFromOrder(baseCustomization, null);
    expect(items.some((i) => i.description === "調整")).toBe(false);
  });
});
