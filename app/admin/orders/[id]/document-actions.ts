"use server";

import { revalidatePath } from "next/cache";
import {
  createClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import {
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/documents/types";
import { issueDocumentWithNotifications } from "@/lib/documents/issue";

export type IssueDocumentResult =
  | { ok: true; documentId: string; documentNumber: string; emailed: boolean }
  | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "ログインが必要です。" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { ok: false as const, error: "管理者権限が必要です。" };
  }
  return { ok: true as const, supabase, userId: user.id };
}

export async function issueDocument(
  orderId: string,
  type: DocumentType,
): Promise<IssueDocumentResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  // Use service role client so we can also send the email (lookup auth.users)
  const svc = await createServiceRoleClient();

  const result = await issueDocumentWithNotifications({
    supabase: svc,
    orderId,
    type,
    issuedBy: auth.userId,
  });

  if (result.error) {
    return {
      ok: false,
      error: `${DOCUMENT_TYPE_LABEL[type]}の発行に失敗: ${result.error}`,
    };
  }

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/account/orders/${orderId}`);

  return {
    ok: true,
    documentId: result.documentId!,
    documentNumber: result.documentNumber!,
    emailed: result.emailed,
  };
}

export async function deleteDocument(
  documentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { data: deleted, error } = await auth.supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .select("order_id, type, document_number")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!deleted) return { ok: false, error: "削除に失敗しました。" };

  revalidatePath(`/admin/orders/${deleted.order_id}`);
  revalidatePath(`/account/orders/${deleted.order_id}`);

  return { ok: true };
}
