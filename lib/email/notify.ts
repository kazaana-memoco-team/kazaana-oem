/**
 * Chat notification emails.
 * - Customer posts → notify BECOS (admins or BECOS_NOTIFY_EMAIL)
 * - BECOS posts    → notify the order's customer
 *
 * Needs a service-role client to read auth.users emails.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { sendEmail } from "./send";
import { ISSUER } from "@/lib/documents/issuer";

type Client = SupabaseClient<Database>;

export async function notifyNewMessage(args: {
  serviceClient: Client;
  orderId: string;
  senderContext: "customer" | "admin";
  body: string;
}): Promise<void> {
  const { serviceClient, orderId, senderContext, body } = args;

  const { data: order } = await serviceClient
    .from("orders")
    .select("id, order_number, customer_id, customization")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const preview = body.length > 140 ? `${body.slice(0, 140)}…` : body;
  const orderNo = order.order_number ?? orderId.slice(0, 8);

  if (senderContext === "customer") {
    // → notify BECOS
    const notifyEmail = process.env.BECOS_NOTIFY_EMAIL;
    let recipients: string[] = [];
    if (notifyEmail) {
      recipients = [notifyEmail];
    } else {
      const { data: admins } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("role", "admin");
      recipients = await lookupEmails(
        serviceClient,
        (admins ?? []).map((a) => a.id),
      );
    }
    const url = `${baseUrl}/admin/orders/${orderId}`;
    await Promise.all(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: `【BECOS OEM】お客様から新着メッセージ（${orderNo}）`,
          body: `注文 ${orderNo} にお客様からメッセージが届きました。\n\n―――\n${preview}\n―――\n\n管理画面で確認・返信:\n${url}`,
        }),
      ),
    );
  } else {
    // → notify customer
    const [email] = await lookupEmails(serviceClient, [order.customer_id]);
    if (!email) return;
    const url = `${baseUrl}/account/orders/${orderId}`;
    await sendEmail({
      to: email,
      subject: `【BECOS】ご注文へのメッセージが届いています（${orderNo}）`,
      body: `BECOSよりご注文 ${orderNo} に関するメッセージが届きました。\n\n―――\n${preview}\n―――\n\nマイページで確認・返信:\n${url}\n\n${ISSUER.company}`,
    });
  }
}

async function lookupEmails(
  client: Client,
  ids: string[],
): Promise<string[]> {
  const adminApi = (
    client as unknown as {
      auth: {
        admin?: {
          getUserById: (
            id: string,
          ) => Promise<{ data: { user: { email: string | null } | null } }>;
        };
      };
    }
  ).auth.admin;
  if (!adminApi) return [];

  const emails: string[] = [];
  for (const id of ids) {
    try {
      const { data } = await adminApi.getUserById(id);
      if (data.user?.email) emails.push(data.user.email);
    } catch {
      // skip
    }
  }
  return emails;
}
