"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
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
  CUSTOM_ORDER_BUDGETS,
  CUSTOM_ORDER_GENRES,
} from "@/lib/custom-order";
import { submitCustomOrder, type SubmitCustomOrderResult } from "./actions";

type Uploaded = { url: string; name: string };

export function CustomOrderForm() {
  const [genre, setGenre] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [images, setImages] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isPending, startTransition] = useTransition();

  const [state, formAction] = useActionState<
    SubmitCustomOrderResult | undefined,
    FormData
  >(submitCustomOrder, undefined);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    const supabase = createClient();
    const next: Uploaded[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          setUploadError(`${file.name} は10MBを超えています`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("reference-images")
          .upload(path, file, { upsert: false });
        if (error) {
          setUploadError(`アップロード失敗: ${error.message}`);
          continue;
        }
        const { data } = supabase.storage
          .from("reference-images")
          .getPublicUrl(path);
        next.push({ url: data.publicUrl, name: file.name });
      }
      setImages((prev) => [...prev, ...next]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <form
      action={(formData) => {
        formData.set(
          "reference_images",
          JSON.stringify(images.map((i) => i.url)),
        );
        startTransition(() => formAction(formData));
      }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="title">件名</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="例：両親への結婚記念日の贈り物"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="genre">ジャンル</Label>
          <Select value={genre} onValueChange={(v) => v && setGenre(v)}>
            <SelectTrigger id="genre">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_ORDER_GENRES.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="genre" value={genre} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget">ご予算</Label>
          <Select value={budget} onValueChange={(v) => v && setBudget(v)}>
            <SelectTrigger id="budget">
              <SelectValue placeholder="選択してください" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOM_ORDER_BUDGETS.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="budget" value={budget} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="quantity">数量</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={999}
            defaultValue={1}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desired_deadline">希望納期（任意）</Label>
          <Input
            id="desired_deadline"
            name="desired_deadline"
            maxLength={40}
            placeholder="例：3ヶ月以内 / 12月上旬まで"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">ご要望の詳細</Label>
        <Textarea
          id="description"
          name="description"
          required
          rows={6}
          maxLength={4000}
          placeholder="作りたいもの、用途、色や素材の好み、サイズ感、贈る相手やシーンなど、できるだけ具体的にお書きください。"
        />
      </div>

      <div className="space-y-2">
        <Label>完成イメージ・参考画像（任意・最大10MB/枚）</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm"
          disabled={uploading}
        />
        {uploading ? (
          <p className="text-xs text-muted-foreground">アップロード中…</p>
        ) : null}
        {uploadError ? (
          <p className="text-xs text-destructive">{uploadError}</p>
        ) : null}
        {images.length > 0 ? (
          <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((img, i) => (
              <li key={img.url} className="relative">
                <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                  <Image
                    src={img.url}
                    alt={img.name}
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setImages((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-xs shadow-sm"
                  aria-label="削除"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={isPending || uploading}>
        {isPending ? "送信中…" : "この内容で相談する"}
      </Button>
      <p className="text-xs text-muted-foreground">
        送信後、BECOSが内容を確認し、対応できる職人を探してお見積もりをお返しします。
        やり取りはマイページのチャットで行います。
      </p>
    </form>
  );
}
