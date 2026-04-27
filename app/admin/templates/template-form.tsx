"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentType } from "@/lib/documents/types";
import { resetEmailTemplate, saveEmailTemplate } from "./actions";

export function TemplateForm({
  type,
  defaultSubject,
  defaultBody,
  initialSubject,
  initialBody,
  isOverride,
}: {
  type: DocumentType;
  defaultSubject: string;
  defaultBody: string;
  initialSubject: string;
  initialBody: string;
  isOverride: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        formData.set("type", type);
        startTransition(async () => {
          const res = await saveEmailTemplate(formData);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setSavedAt(new Date().toLocaleTimeString("ja-JP"));
        });
      }}
      className="space-y-3 rounded-lg border bg-background p-4"
    >
      <div className="space-y-1">
        <Label htmlFor={`subject-${type}`}>件名</Label>
        <Input
          id={`subject-${type}`}
          name="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`body-${type}`}>本文</Label>
        <Textarea
          id={`body-${type}`}
          name="body"
          rows={12}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="font-mono text-xs"
          maxLength={10000}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {savedAt ? (
        <p className="text-xs text-muted-foreground">保存しました ({savedAt})</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "保存中…" : "保存"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            setSubject(defaultSubject);
            setBody(defaultBody);
          }}
        >
          デフォルトに戻す
        </Button>
        {isOverride ? (
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm("このテンプレートのカスタム設定を削除しますか？")) {
                return;
              }
              startTransition(async () => {
                const res = await resetEmailTemplate(type);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setSubject(defaultSubject);
                setBody(defaultBody);
              });
            }}
          >
            カスタム設定を削除
          </Button>
        ) : null}
      </div>
    </form>
  );
}
