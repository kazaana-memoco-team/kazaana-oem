"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeEstimatedTotal,
  type CustomizationValues,
  type OemProductConfig,
} from "@/lib/oem-products";
import { submitCustomization, type SubmitResult } from "./actions";

type Variant = {
  id: string;
  title: string;
  price: string;
  available: boolean;
};

export function CustomizeForm({
  handle,
  cfg,
  variants,
}: {
  handle: string;
  cfg: OemProductConfig;
  variants: Variant[];
}) {
  const firstAvailable = variants.find((v) => v.available) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable.id);
  const [quantity, setQuantity] = useState(1);
  const [textEngraving, setTextEngraving] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  const [state, formAction] = useActionState<
    SubmitResult | undefined,
    FormData
  >(
    async (_prev, formData) => submitCustomization(handle, formData),
    undefined,
  );

  const selectedVariant =
    variants.find((v) => v.id === variantId) ?? firstAvailable;

  const fields = cfg.customizations;
  const hasTextField = fields.some((f) => f.kind === "text_engraving");
  const hasGiftMessage = fields.some((f) => f.kind === "gift_message");
  const hasGiftWrap = fields.some((f) => f.kind === "gift_wrap");
  const hasNotes = fields.some((f) => f.kind === "notes");

  const textCfg = fields.find((f) => f.kind === "text_engraving") as
    | Extract<(typeof fields)[number], { kind: "text_engraving" }>
    | undefined;
  const giftMsgCfg = fields.find((f) => f.kind === "gift_message") as
    | Extract<(typeof fields)[number], { kind: "gift_message" }>
    | undefined;

  const values: CustomizationValues = useMemo(
    () => ({
      variant_id: selectedVariant.id,
      variant_title: selectedVariant.title,
      unit_price: Number(selectedVariant.price),
      quantity,
      text_engraving: textEngraving || undefined,
      gift_message: giftMessage || undefined,
      gift_wrap: giftWrap || undefined,
      notes: notes || undefined,
    }),
    [
      selectedVariant.id,
      selectedVariant.title,
      selectedVariant.price,
      quantity,
      textEngraving,
      giftMessage,
      giftWrap,
      notes,
    ],
  );

  const estimatedTotal = computeEstimatedTotal(cfg, values);

  return (
    <form
      action={(formData) => {
        startTransition(() => {
          formAction(formData);
        });
      }}
      className="space-y-5"
    >
      <input type="hidden" name="variant_id" value={selectedVariant.id} />
      <input
        type="hidden"
        name="variant_title"
        value={selectedVariant.title}
      />
      <input
        type="hidden"
        name="unit_price"
        value={selectedVariant.price}
      />

      <div className="space-y-2">
        <Label htmlFor="variant">バリアント</Label>
        <Select
          value={variantId}
          onValueChange={(v) => v && setVariantId(v)}
        >
          <SelectTrigger id="variant">
            <SelectValue placeholder="選択" />
          </SelectTrigger>
          <SelectContent>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id} disabled={!v.available}>
                {v.title} — {formatYen(v.price)}
                {v.available ? "" : "（在庫切れ）"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantity">数量</Label>
        <Input
          id="quantity"
          name="quantity"
          type="number"
          min={1}
          max={20}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          required
        />
      </div>

      {hasTextField && textCfg ? (
        <div className="space-y-2">
          <Label htmlFor="text_engraving">{textCfg.label}</Label>
          <Input
            id="text_engraving"
            name="text_engraving"
            type="text"
            maxLength={textCfg.maxLength}
            value={textEngraving}
            onChange={(e) => setTextEngraving(e.target.value)}
            placeholder={`例：山田太郎（最大${textCfg.maxLength}文字）`}
          />
          <p className="text-xs text-muted-foreground">
            {textEngraving.length}/{textCfg.maxLength}
            {textEngraving
              ? `　＋ ¥${(cfg.fees.text_engraving ?? 0).toLocaleString("ja-JP")} × ${quantity}個`
              : ""}
          </p>
        </div>
      ) : null}

      {hasGiftMessage && giftMsgCfg ? (
        <div className="space-y-2">
          <Label htmlFor="gift_message">{giftMsgCfg.label}</Label>
          <Textarea
            id="gift_message"
            name="gift_message"
            maxLength={giftMsgCfg.maxLength}
            rows={2}
            value={giftMessage}
            onChange={(e) => setGiftMessage(e.target.value)}
            placeholder="例：お誕生日おめでとう！"
          />
          <p className="text-xs text-muted-foreground">
            {giftMessage.length}/{giftMsgCfg.maxLength}
          </p>
        </div>
      ) : null}

      {hasGiftWrap ? (
        <div className="flex items-center gap-3">
          <input
            id="gift_wrap"
            name="gift_wrap"
            type="checkbox"
            checked={giftWrap}
            onChange={(e) => setGiftWrap(e.target.checked)}
            className="size-4 rounded border-border"
          />
          <Label htmlFor="gift_wrap" className="cursor-pointer">
            ギフトラッピング　＋ ¥
            {(cfg.fees.gift_wrap ?? 0).toLocaleString("ja-JP")}
          </Label>
        </div>
      ) : null}

      {hasNotes ? (
        <div className="space-y-2">
          <Label htmlFor="notes">備考</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ご希望・特記事項があればご記入ください"
          />
        </div>
      ) : null}

      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">概算金額</span>
          <span className="text-lg font-semibold">
            {formatYen(String(estimatedTotal))}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          ※ 最終金額はBECOSからの見積もり後、お支払い前に再確認できます。
        </p>
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "送信中…" : "見積もり依頼を送る"}
      </Button>
    </form>
  );
}

function formatYen(price: string): string {
  const num = Number(price);
  if (Number.isNaN(num)) return price;
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(num);
}
