/**
 * Self-contained HTML template for the document PDFs.
 * Standalone (no external CSS), so Puppeteer can render it directly via
 * `setContent()` without network access.
 */

import fs from "node:fs";
import path from "node:path";
import { ISSUER, TAX_RATE } from "./issuer";
import {
  DOCUMENT_INTRO,
  DOCUMENT_TITLE,
} from "./numbering";
import type { DocumentType } from "./types";
import type { DocumentLineItem } from "@/components/documents/document-template";

let cachedLogo: string | null = null;
let cachedSeal: string | null = null;

function imageDataUri(file: string, cache: { current: string | null }): string {
  if (cache.current) return cache.current;
  const buf = fs.readFileSync(
    path.join(process.cwd(), "public", "brand", file),
  );
  const uri = `data:image/png;base64,${buf.toString("base64")}`;
  cache.current = uri;
  return uri;
}

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export type RenderDocumentHtmlInput = {
  type: DocumentType;
  documentNumber: string;
  issuedAt: string;
  recipientName: string;
  items: DocumentLineItem[];
  shipping?: number;
  notes?: string | null;
  metaLines?: Array<{ label: string; value: string }>;
};

export function renderDocumentHtml(
  input: RenderDocumentHtmlInput,
): string {
  const logo = imageDataUri("becos-logo.png", { current: cachedLogo });
  const seal = imageDataUri("kazaana-seal.png", { current: cachedSeal });
  cachedLogo = logo;
  cachedSeal = seal;

  const {
    type,
    documentNumber,
    issuedAt,
    recipientName,
    items,
    shipping = 0,
    notes,
    metaLines = [],
  } = input;

  const subtotal = items.reduce(
    (sum, l) => sum + l.unitPrice * l.quantity,
    0,
  );
  const total = subtotal + shipping;
  const includedTax = Math.round(total - total / (1 + TAX_RATE));

  const issuedStr = formatDate(issuedAt);

  const itemRows = items
    .map(
      (it) => `
      <tr>
        <td class="cell-desc">${escapeHtml(it.description)}</td>
        <td class="cell-num">${yen.format(it.unitPrice)}</td>
        <td class="cell-num">${it.quantity}</td>
        <td class="cell-num">${yen.format(it.unitPrice * it.quantity)}</td>
      </tr>`,
    )
    .join("");

  const metaHtml = metaLines
    .map(
      (m) =>
        `<p class="meta"><span class="meta-label">${escapeHtml(m.label)}:</span> ${escapeHtml(m.value)}</p>`,
    )
    .join("");

  const notesHtml = notes
    ? `<p class="meta"><span class="meta-label">備考:</span> ${escapeHtml(notes)}</p>`
    : "";

  const bankHtml =
    type === "invoice" && ISSUER.bank.name
      ? `
        <section class="bank">
          <p class="bank-label">お振込先</p>
          <p>${escapeHtml(ISSUER.bank.name)} ${escapeHtml(ISSUER.bank.branch)} / ${escapeHtml(ISSUER.bank.accountType)} ${escapeHtml(ISSUER.bank.accountNumber)}</p>
          <p>${escapeHtml(ISSUER.bank.accountHolder)}</p>
        </section>`
      : "";

  const invoiceRegHtml = ISSUER.invoiceRegistrationNumber
    ? `<p class="muted">登録番号 ${escapeHtml(ISSUER.invoiceRegistrationNumber)}</p>`
    : "";

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(DOCUMENT_TITLE[type])} ${escapeHtml(documentNumber)}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic',
        'Yu Gothic UI', 'Noto Sans JP', 'Meiryo', system-ui, sans-serif;
      font-feature-settings: 'palt';
      color: #1f1f1f;
      background: #fff;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 16mm 16mm 18mm;
      position: relative;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; }
    .eyebrow {
      font-size: 9pt;
      letter-spacing: 0.25em;
      color: #a1a1a8;
      text-transform: uppercase;
    }
    .title {
      margin: 12px 0 0;
      font-size: 22pt;
      font-weight: 500;
      letter-spacing: 0.4em;
    }
    .header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
    .header-right img { height: 48px; object-fit: contain; }
    .doc-meta { text-align: right; font-size: 9pt; color: #666; line-height: 1.7; }
    .doc-meta .label { color: #a1a1a8; }
    .doc-meta .value { color: #2b2b2b; font-weight: 500; letter-spacing: 0.05em; }

    .divider { height: 1px; background: #e5e5ea; margin: 28px 0; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; }
    .columns h3 {
      font-size: 8.5pt;
      letter-spacing: 0.2em;
      color: #a1a1a8;
      margin: 0;
      text-transform: uppercase;
      font-weight: 500;
    }
    .recipient-name { margin-top: 12px; font-size: 14pt; font-weight: 500; letter-spacing: 0.05em; }
    .from-info { margin-top: 12px; font-size: 10pt; line-height: 1.7; color: #444; }
    .from-info .company { font-size: 12pt; font-weight: 500; color: #1f1f1f; }
    .seal { position: absolute; right: 0; top: 8px; width: 80px; height: 80px; object-fit: contain; }
    .from { position: relative; }

    .intro { margin-top: 40px; font-size: 10.5pt; color: #444; }

    .total-row {
      margin-top: 20px;
      border-top: 1px solid #d4d4d8;
      border-bottom: 1px solid #d4d4d8;
      padding: 18px 0;
      display: flex;
      align-items: baseline;
      gap: 24px;
    }
    .total-row .label { font-size: 10pt; letter-spacing: 0.2em; color: #71717a; }
    .total-row .value { font-size: 28pt; font-weight: 500; letter-spacing: 0.04em; }
    .total-row .tax { font-size: 9pt; color: #a1a1a8; }

    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-top: 36px;
      font-size: 10pt;
    }
    table.items th {
      text-align: left;
      font-size: 9pt;
      letter-spacing: 0.15em;
      font-weight: 500;
      color: #71717a;
      border-bottom: 1px solid #d4d4d8;
      padding: 0 8px 8px 0;
    }
    table.items th:first-child { padding-left: 0; }
    table.items th.num { text-align: right; padding-right: 0; padding-left: 8px; }
    table.items td {
      padding: 12px 8px;
      border-bottom: 1px solid #f1f1f3;
      vertical-align: top;
    }
    table.items td:first-child { padding-left: 0; }
    .cell-num { text-align: right; font-variant-numeric: tabular-nums; }
    .cell-num.last { padding-right: 0; }
    table.items td.cell-desc { padding-right: 16px; line-height: 1.6; }

    .totals-box {
      margin: 24px 0 0 auto;
      width: 280px;
      font-size: 10pt;
    }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; color: #555; }
    .totals-row .v { font-variant-numeric: tabular-nums; }
    .totals-divider { height: 1px; background: #e5e5ea; margin: 6px 0; }
    .totals-row.grand { font-size: 14pt; font-weight: 500; color: #1f1f1f; }

    .meta-block { margin-top: 48px; font-size: 9pt; color: #555; line-height: 1.7; }
    .meta { margin: 0 0 4px; }
    .meta-label { color: #a1a1a8; margin-right: 8px; }

    .bank {
      margin-top: 32px;
      padding: 16px;
      border: 1px solid #e5e5ea;
      border-radius: 6px;
      font-size: 9.5pt;
      color: #444;
      line-height: 1.7;
    }
    .bank-label { font-size: 8.5pt; letter-spacing: 0.2em; color: #a1a1a8; text-transform: uppercase; margin: 0 0 8px; }
    .muted { color: #a1a1a8; }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div>
        <div class="eyebrow">${eyebrowFor(type)}</div>
        <h1 class="title">${escapeHtml(DOCUMENT_TITLE[type])}</h1>
      </div>
      <div class="header-right">
        <img src="${logo}" alt="${escapeHtml(ISSUER.brandTagline)}" />
        <div class="doc-meta">
          <p><span class="label">No.</span> <span class="value">${escapeHtml(documentNumber)}</span></p>
          <p><span class="label">発行日</span> ${escapeHtml(issuedStr)}</p>
        </div>
      </div>
    </header>

    <div class="divider"></div>

    <section class="columns">
      <div>
        <h3>To</h3>
        <p class="recipient-name">${escapeHtml(recipientName)}</p>
      </div>
      <div class="from">
        <h3>From</h3>
        <div class="from-info">
          <p class="company">${escapeHtml(ISSUER.company)}</p>
          <p>${escapeHtml(ISSUER.representative)}</p>
          <p>${escapeHtml(ISSUER.postalCode)}</p>
          <p>${escapeHtml(ISSUER.address)}</p>
          ${invoiceRegHtml}
        </div>
        <img src="${seal}" alt="社判" class="seal" />
      </div>
    </section>

    <p class="intro">${escapeHtml(DOCUMENT_INTRO[type])}</p>

    <section class="total-row">
      <span class="label">合計金額</span>
      <span class="value">${yen.format(total)}</span>
      <span class="tax">（税込）</span>
    </section>

    <table class="items">
      <thead>
        <tr>
          <th>品名</th>
          <th class="num">単価</th>
          <th class="num">数量</th>
          <th class="num">金額</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row"><span>小計</span><span class="v">${yen.format(subtotal)}</span></div>
      <div class="totals-row"><span>送料</span><span class="v">${yen.format(shipping)}</span></div>
      <div class="totals-row"><span>税（${Math.round(TAX_RATE * 100)}% 内税）</span><span class="v">(${yen.format(includedTax)})</span></div>
      <div class="totals-divider"></div>
      <div class="totals-row grand"><span>合計</span><span class="v">${yen.format(total)}</span></div>
    </div>

    <section class="meta-block">
      ${metaHtml}
      ${notesHtml}
    </section>

    ${bankHtml}
  </div>
</body>
</html>`;
}

function eyebrowFor(type: DocumentType): string {
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
