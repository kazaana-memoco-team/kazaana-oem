/**
 * A4 portrait document template — quote / invoice / delivery / receipt.
 * Refined, minimal, generous whitespace; no heavy table grid.
 *
 * Styling notes:
 *  - The outer @page rule is added in the host page (app/documents/[id]/page.tsx)
 *  - The visible page mimics A4 dimensions (210mm × 297mm) with 16mm padding
 *  - Uses system Japanese fonts for crisp printing without bundling TTFs
 */

import Image from "next/image";
import { ISSUER, TAX_RATE } from "@/lib/documents/issuer";
import {
  DOCUMENT_INTRO,
  DOCUMENT_TITLE,
} from "@/lib/documents/numbering";
import type { DocumentType } from "@/lib/documents/types";

export type DocumentLineItem = {
  description: string;
  unitPrice: number;
  quantity: number;
};

export type DocumentTemplateProps = {
  type: DocumentType;
  documentNumber: string;
  issuedAt: string; // ISO date
  recipientName: string; // "山田太郎 様" / "預金保険機構 御中"
  /** Optional second line for recipient (department / address etc.) */
  recipientSubLine?: string | null;
  intro?: string | null;
  items: DocumentLineItem[];
  shipping?: number;
  /** Free-form note shown bottom-left */
  notes?: string | null;
  /** Quote: validity ; Invoice: due date ; Delivery: delivery date ; Receipt: but-gaki */
  metaLines?: Array<{ label: string; value: string }>;
};

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export function DocumentTemplate(props: DocumentTemplateProps) {
  const {
    type,
    documentNumber,
    issuedAt,
    recipientName,
    recipientSubLine,
    intro,
    items,
    shipping = 0,
    notes,
    metaLines = [],
  } = props;

  const subtotal = items.reduce(
    (sum, l) => sum + l.unitPrice * l.quantity,
    0,
  );
  // Sample uses tax-inclusive total; show the included tax separately in
  // parentheses (matches the existing BECOS docs).
  const total = subtotal + shipping;
  const includedTax = Math.round(total - total / (1 + TAX_RATE));

  const issuedDateStr = formatDate(issuedAt);

  return (
    <div className="document-page mx-auto bg-white text-[10.5pt] text-zinc-900">
      {/* ─── Header ─────────────────────────────────────── */}
      <header className="flex items-start justify-between">
        <div>
          <p className="text-[9pt] uppercase tracking-[0.25em] text-zinc-400">
            {documentTypeEnglish(type)}
          </p>
          <h1 className="mt-3 text-[22pt] font-medium tracking-[0.4em]">
            {DOCUMENT_TITLE[type]}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Image
            src="/brand/becos-logo.png"
            alt={ISSUER.brandTagline}
            width={140}
            height={48}
            className="h-12 w-auto object-contain"
            priority
          />
          <div className="text-right text-[9pt] leading-relaxed text-zinc-600">
            <p>
              <span className="text-zinc-400">No.</span>{" "}
              <span className="font-medium tracking-wider text-zinc-800">
                {documentNumber}
              </span>
            </p>
            <p>
              <span className="text-zinc-400">発行日</span> {issuedDateStr}
            </p>
          </div>
        </div>
      </header>

      <div className="mt-10 h-px w-full bg-zinc-200" />

      {/* ─── Recipient / Issuer ─────────────────────────── */}
      <section className="mt-8 grid grid-cols-2 gap-12">
        <div>
          <p className="text-[8.5pt] uppercase tracking-[0.2em] text-zinc-400">
            To
          </p>
          <p className="mt-3 text-[14pt] font-medium tracking-wide">
            {recipientName}
          </p>
          {recipientSubLine ? (
            <p className="mt-1 text-[10pt] text-zinc-500">{recipientSubLine}</p>
          ) : null}
        </div>
        <div className="relative">
          <p className="text-[8.5pt] uppercase tracking-[0.2em] text-zinc-400">
            From
          </p>
          <div className="mt-3 space-y-0.5 text-[10pt] leading-relaxed text-zinc-700">
            <p className="text-[12pt] font-medium tracking-wide text-zinc-900">
              {ISSUER.company}
            </p>
            <p>{ISSUER.representative}</p>
            <p>{ISSUER.postalCode}</p>
            <p>{ISSUER.address}</p>
            {ISSUER.invoiceRegistrationNumber ? (
              <p className="text-zinc-500">
                登録番号 {ISSUER.invoiceRegistrationNumber}
              </p>
            ) : null}
          </div>
          <Image
            src="/brand/kazaana-seal.png"
            alt="社判"
            width={80}
            height={80}
            className="absolute right-0 top-2 h-20 w-20 object-contain"
          />
        </div>
      </section>

      {/* ─── Intro ──────────────────────────────────────── */}
      <p className="mt-12 text-[10.5pt] text-zinc-700">
        {intro ?? DOCUMENT_INTRO[type]}
      </p>

      {/* ─── Total spotlight ────────────────────────────── */}
      <section className="mt-6 flex items-baseline gap-6 border-y border-zinc-300 py-5">
        <p className="text-[10pt] tracking-[0.2em] text-zinc-500">合計金額</p>
        <p className="text-[28pt] font-medium tracking-wide tabular-nums">
          {yen.format(total)}
        </p>
        <span className="text-[9pt] text-zinc-400">（税込）</span>
      </section>

      {/* ─── Items ──────────────────────────────────────── */}
      <section className="mt-10">
        <table className="w-full border-collapse text-[10pt]">
          <thead>
            <tr className="text-zinc-500">
              <th className="border-b border-zinc-300 pb-2 pr-4 text-left text-[9pt] font-medium tracking-[0.15em]">
                品名
              </th>
              <th className="w-28 border-b border-zinc-300 pb-2 px-2 text-right text-[9pt] font-medium tracking-[0.15em]">
                単価
              </th>
              <th className="w-16 border-b border-zinc-300 pb-2 px-2 text-right text-[9pt] font-medium tracking-[0.15em]">
                数量
              </th>
              <th className="w-32 border-b border-zinc-300 pb-2 pl-2 text-right text-[9pt] font-medium tracking-[0.15em]">
                金額
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-zinc-100 align-top">
                <td className="py-3 pr-4 leading-relaxed">{item.description}</td>
                <td className="py-3 px-2 text-right tabular-nums">
                  {yen.format(item.unitPrice)}
                </td>
                <td className="py-3 px-2 text-right tabular-nums">
                  {item.quantity}
                </td>
                <td className="py-3 pl-2 text-right tabular-nums">
                  {yen.format(item.unitPrice * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals box (right-aligned) */}
        <div className="mt-6 ml-auto w-72 space-y-2 text-[10pt]">
          <Row label="小計" value={yen.format(subtotal)} muted />
          <Row label="送料" value={yen.format(shipping)} muted />
          <Row
            label={`税（${Math.round(TAX_RATE * 100)}% 内税）`}
            value={`(${yen.format(includedTax)})`}
            muted
          />
          <div className="my-2 h-px bg-zinc-200" />
          <Row
            label="合計"
            value={yen.format(total)}
            emphasized
          />
        </div>
      </section>

      {/* ─── Footer notes ───────────────────────────────── */}
      <section className="mt-12 space-y-1 text-[9pt] leading-relaxed text-zinc-600">
        {metaLines.map((m) => (
          <p key={m.label}>
            <span className="mr-2 text-zinc-400">{m.label}:</span>
            {m.value}
          </p>
        ))}
        {notes ? (
          <p className="whitespace-pre-wrap">
            <span className="mr-2 text-zinc-400">備考:</span>
            {notes}
          </p>
        ) : null}
      </section>

      {type === "invoice" && ISSUER.bank.name ? (
        <section className="mt-8 rounded-md border border-zinc-200 p-4 text-[9.5pt] leading-relaxed text-zinc-700">
          <p className="text-[8.5pt] uppercase tracking-[0.2em] text-zinc-400">
            お振込先
          </p>
          <p className="mt-2">
            {ISSUER.bank.name} {ISSUER.bank.branch} / {ISSUER.bank.accountType}{" "}
            {ISSUER.bank.accountNumber}
          </p>
          <p>{ISSUER.bank.accountHolder}</p>
        </section>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  emphasized,
}: {
  label: string;
  value: string;
  muted?: boolean;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between ${
        emphasized ? "text-[14pt] font-medium" : muted ? "text-zinc-600" : ""
      }`}
    >
      <span className={muted ? "text-zinc-500" : ""}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function documentTypeEnglish(type: DocumentType): string {
  switch (type) {
    case "quote":
      return "Quotation";
    case "invoice":
      return "Invoice";
    case "delivery":
      return "Delivery Note";
    case "receipt":
      return "Receipt";
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
