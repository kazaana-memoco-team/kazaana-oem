"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/documents/types";
import { issueDocument } from "./document-actions";

// 見積書: admin が確定金額を保存した時に自動発行
// 請求書/納品書/領収書: 支払い完了 webhook で自動発行
// このボタンは未発行のものを「手動で発行」する保険として残す
const TYPES: DocumentType[] = ["quote", "invoice", "delivery", "receipt"];

export function IssueDocumentButtons({
  orderId,
  alreadyIssued,
}: {
  orderId: string;
  alreadyIssued: DocumentType[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<DocumentType | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => {
          const issued = alreadyIssued.includes(t);
          const busy = pendingType === t;
          return (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={issued ? "outline" : "default"}
              disabled={issued || !!pendingType}
              onClick={() => {
                if (issued) return;
                setError(null);
                setPendingType(t);
                startTransition(async () => {
                  const res = await issueDocument(orderId, t);
                  setPendingType(null);
                  if (!res.ok) {
                    setError(res.error);
                  }
                });
              }}
            >
              {busy ? "発行中…" : issued ? `${DOCUMENT_TYPE_LABEL[t]} ✓` : `${DOCUMENT_TYPE_LABEL[t]} を発行`}
            </Button>
          );
        })}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        通常、見積書は確定金額の保存時に・請求書/納品書/領収書は支払い完了時に自動発行されます。
        上のボタンは保険として手動で発行するためのものです。
      </p>
    </div>
  );
}
