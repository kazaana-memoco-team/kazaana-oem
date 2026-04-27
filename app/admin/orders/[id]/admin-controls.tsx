"use client";

import { useState, useTransition } from "react";
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
import { updateOrder } from "./actions";

const STATUS_OPTIONS = [
  { value: "draft", label: "下書き" },
  { value: "awaiting_quote", label: "見積もり依頼中" },
  { value: "quoted", label: "見積もり提示済み" },
  { value: "paid", label: "支払い完了" },
  { value: "in_production", label: "製作中" },
  { value: "shipped", label: "発送済み" },
  { value: "completed", label: "完了" },
  { value: "cancelled", label: "キャンセル" },
];

export function AdminControls({
  orderId,
  initialStatus,
  initialFinalPrice,
  initialInternalNotes,
}: {
  orderId: string;
  initialStatus: string;
  initialFinalPrice: number | null;
  initialInternalNotes: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [finalPrice, setFinalPrice] = useState<string>(
    initialFinalPrice != null ? String(initialFinalPrice) : "",
  );
  const [internalNotes, setInternalNotes] = useState<string>(
    initialInternalNotes ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await updateOrder(orderId, formData);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setSavedAt(new Date().toLocaleTimeString("ja-JP"));
        });
      }}
      className="space-y-4 rounded-lg border bg-muted/30 p-5"
    >
      <h2 className="text-base font-medium">管理操作</h2>

      <div className="space-y-2">
        <Label htmlFor="status">ステータス</Label>
        <Select value={status} onValueChange={(v) => v && setStatus(v)}>
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="status" value={status} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="final_price">確定金額（円）</Label>
        <Input
          id="final_price"
          name="final_price"
          type="number"
          min={0}
          step={1}
          value={finalPrice}
          onChange={(e) => setFinalPrice(e.target.value)}
          placeholder="未設定"
        />
        <p className="text-xs text-muted-foreground">
          空欄なら未設定。設定すると顧客の注文詳細に表示されます。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="internal_notes">社内メモ（顧客には表示されない）</Label>
        <Textarea
          id="internal_notes"
          name="internal_notes"
          rows={3}
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          placeholder="どの職人と進めるか、納期、社内連絡など"
        />
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {savedAt && !error ? (
        <p className="text-xs text-muted-foreground">保存しました ({savedAt})</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "保存中…" : "変更を保存"}
      </Button>
    </form>
  );
}
