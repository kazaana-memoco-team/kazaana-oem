"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inviteAdmin, type InviteAdminResult } from "./actions";

export function InviteAdminForm() {
  const [state, formAction, pending] = useActionState<
    InviteAdminResult | undefined,
    FormData
  >(inviteAdmin, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="new-admin@example.com"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="display_name">表示名（任意）</Label>
            <Input
              id="display_name"
              name="display_name"
              type="text"
              maxLength={80}
              placeholder="例: 山田太郎"
            />
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "招待中…" : "管理者を招待"}
        </Button>
      </form>

      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      {state?.ok ? (
        <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <p className="font-medium text-emerald-700">
            招待を作成しました
            {state.emailed
              ? "（招待メールを送信しました）"
              : "（メール送信はスキップ／失敗。下記リンクを手動で共有してください）"}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs">
              {state.inviteUrl}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(state.inviteUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? "コピー済" : "コピー"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
