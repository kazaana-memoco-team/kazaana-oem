/**
 * Shared document-issue helper.
 * - Inserts a document row (one per order per type)
 * - Posts a chat message attributed to admin (best-effort)
 * - Sends an email to the customer using the configured template
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import {
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "./types";
import { ISSUER } from "./issuer";
import {
  applyTemplate,
  DEFAULT_EMAIL_TEMPLATES,
  type EmailTemplate,
} from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { uploadFileToFolder } from "@/lib/google/drive";
import { renderDocumentHtml } from "./html-template";
import { htmlToPdf } from "./pdf-generator";
import { buildLineItemsFromOrder } from "./build-items";

const DRIVE_FOLDER_ENV: Record<DocumentType, string> = {
  quote: "GOOGLE_DRIVE_FOLDER_QUOTE",
  invoice: "GOOGLE_DRIVE_FOLDER_INVOICE",
  delivery: "GOOGLE_DRIVE_FOLDER_DELIVERY",
  receipt: "GOOGLE_DRIVE_FOLDER_RECEIPT",
};

type Client = SupabaseClient<Database>;

const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export type IssueResult = {
  type: DocumentType;
  documentId?: string;
  documentNumber?: string;
  emailed: boolean;
  chatPosted: boolean;
  drivePath?: string;
  driveUrl?: string | null;
  error?: string;
};

export async function issueDocumentWithNotifications(args: {
  supabase: Client;
  orderId: string;
  type: DocumentType;
  /** Profile id used as `issued_by` and as the chat sender. If null, will look up an admin. */
  issuedBy?: string | null;
}): Promise<IssueResult> {
  const { supabase, orderId, type } = args;

  // 1) Order data
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_id, estimated_price, final_price, customization",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) {
    return {
      type,
      emailed: false,
      chatPosted: false,
      error: orderErr?.message ?? "order not found",
    };
  }
  if (!order.order_number) {
    return {
      type,
      emailed: false,
      chatPosted: false,
      error: "order_number not assigned",
    };
  }

  // 2) Skip if already issued
  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("order_id", orderId)
    .eq("type", type)
    .maybeSingle();
  if (existing) {
    return {
      type,
      emailed: false,
      chatPosted: false,
      error: "already issued",
    };
  }

  // 3) Determine issuedBy — fall back to first admin profile
  let issuedBy = args.issuedBy ?? null;
  if (!issuedBy) {
    const { data: anyAdmin } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    issuedBy = anyAdmin?.id ?? null;
  }

  const amount = order.final_price ?? order.estimated_price ?? null;

  // 4) Insert
  const { data: inserted, error: insertErr } = await supabase
    .from("documents")
    .insert({
      order_id: orderId,
      type,
      document_number: order.order_number,
      amount,
      issued_by: issuedBy,
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return {
      type,
      emailed: false,
      chatPosted: false,
      error: insertErr?.message ?? "insert failed",
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const documentUrl = `${baseUrl}/documents/${inserted.id}`;
  const label = DOCUMENT_TYPE_LABEL[type];

  // 5) Customer profile + email lookup
  const { data: customer } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", order.customer_id)
    .maybeSingle();
  const customerName = customer?.display_name ?? "ご注文者様";

  // 6) Chat message (best-effort)
  let chatPosted = false;
  if (issuedBy) {
    const { error: chatErr } = await supabase.from("messages").insert({
      order_id: orderId,
      sender_id: issuedBy,
      body: `📄 ${label}（${order.order_number}）を発行しました。\n${documentUrl}`,
      sender_context: "admin",
    });
    chatPosted = !chatErr;
  }

  // 7) Email (best-effort) — needs the auth.users.email which RLS blocks for non-admin clients
  let emailed = false;
  try {
    const customerEmail = await lookupCustomerEmail(supabase, order.customer_id);
    if (customerEmail) {
      const tpl = await loadTemplate(supabase, type);
      const rendered = applyTemplate(tpl, {
        customer_name: customerName,
        document_number: order.order_number,
        document_type: label,
        document_url: documentUrl,
        amount: amount != null ? yen.format(amount) : "—",
        company: ISSUER.company,
      });
      const res = await sendEmail({
        to: customerEmail,
        subject: rendered.subject,
        body: rendered.body,
      });
      emailed = res.ok;
    }
  } catch (e) {
    console.error("[issue] email send failed", e);
  }

  // 8) PDF generation + Drive upload (best-effort)
  let driveFileId: string | null = null;
  let driveUrl: string | null = null;
  try {
    const folderId = process.env[DRIVE_FOLDER_ENV[type]];
    if (folderId) {
      const items = buildLineItemsFromOrder(order.customization);
      const html = renderDocumentHtml({
        type,
        documentNumber: order.order_number,
        issuedAt: new Date().toISOString(),
        recipientName: formatRecipientName(customerName),
        items,
        notes: null,
        metaLines: defaultMetaLines(type),
      });
      const pdf = await htmlToPdf(html);
      const uploaded = await uploadFileToFolder({
        parentId: folderId,
        fileName: `${order.order_number}_${label}.pdf`,
        mimeType: "application/pdf",
        content: pdf,
      });
      driveFileId = uploaded.id;
      driveUrl = uploaded.webViewLink;

      // Persist drive metadata on the document row
      await supabase
        .from("documents")
        .update({
          metadata: {
            drive_file_id: driveFileId,
            drive_view_url: driveUrl,
          },
        })
        .eq("id", inserted.id);
    }
  } catch (e) {
    console.error("[issue] PDF/Drive upload failed", e);
  }

  // 9) order_events
  await supabase.from("order_events").insert({
    order_id: orderId,
    actor_id: issuedBy,
    event_type: "document_issued",
    payload: {
      document_id: inserted.id,
      type,
      document_number: order.order_number,
      emailed,
      chat_posted: chatPosted,
      drive_file_id: driveFileId,
    },
  });

  return {
    type,
    documentId: inserted.id,
    documentNumber: order.order_number,
    emailed,
    chatPosted,
    drivePath: driveFileId ?? undefined,
    driveUrl,
  };
}

function formatRecipientName(name: string): string {
  const looksLikeCompany = /(株式会社|有限会社|合同会社|合資会社|御中)/.test(
    name,
  );
  return looksLikeCompany
    ? name.replace(/\s*御中\s*$/, "") + " 御中"
    : `${name} 様`;
}

function defaultMetaLines(
  type: DocumentType,
): Array<{ label: string; value: string }> {
  const today = new Date();
  if (type === "quote") {
    return [{ label: "有効期限", value: "発行日より1ヶ月" }];
  }
  if (type === "invoice") {
    const due = new Date(today);
    due.setDate(due.getDate() + 30);
    return [
      {
        label: "お支払期限",
        value: `${due.getFullYear()}年${due.getMonth() + 1}月${due.getDate()}日`,
      },
    ];
  }
  if (type === "delivery") {
    return [
      {
        label: "納品日",
        value: `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`,
      },
    ];
  }
  return [];
}

async function loadTemplate(
  supabase: Client,
  type: DocumentType,
): Promise<EmailTemplate> {
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", `email.${type}`)
    .maybeSingle();
  const v = data?.value as { subject?: string; body?: string } | null;
  if (v?.subject && v?.body) {
    return { subject: v.subject, body: v.body };
  }
  return DEFAULT_EMAIL_TEMPLATES[type];
}

/**
 * Look up the customer's email. Requires service role (auth.admin) to read
 * auth.users; with a normal client this returns null.
 */
async function lookupCustomerEmail(
  supabase: Client,
  customerId: string,
): Promise<string | null> {
  // The service-role client exposes `auth.admin`; a normal one throws.
  const adminApi = (supabase as unknown as {
    auth: { admin?: { getUserById: (id: string) => Promise<{ data: { user: { email: string | null } | null } }> } };
  }).auth.admin;
  if (!adminApi) return null;
  try {
    const { data } = await adminApi.getUserById(customerId);
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}
