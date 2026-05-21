import { createServiceRoleClient } from "@/lib/supabase/server";
import { InviteAdminForm } from "./invite-admin-form";

export const dynamic = "force-dynamic";

type AdminRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  confirmed: boolean;
  createdAt: string | null;
};

export default async function AdminsPage() {
  const svc = await createServiceRoleClient();

  const { data: profiles } = await svc
    .from("profiles")
    .select("id, display_name, created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  const rows: AdminRow[] = [];
  for (const p of profiles ?? []) {
    let email: string | null = null;
    let confirmed = false;
    let createdAt: string | null = p.created_at;
    try {
      const { data } = await svc.auth.admin.getUserById(p.id);
      email = data.user?.email ?? null;
      confirmed = !!data.user?.email_confirmed_at;
      createdAt = data.user?.created_at ?? p.created_at;
    } catch {
      // skip lookup failure
    }
    rows.push({
      id: p.id,
      display_name: p.display_name,
      email,
      confirmed,
      createdAt,
    });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <h1 className="text-2xl font-semibold">管理者</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        メールで新しい管理者を招待できます。招待された方はリンクからパスワードを設定して参加します。
      </p>

      <section className="mt-6 rounded-lg border bg-muted/30 p-5">
        <h2 className="text-base font-medium">管理者を招待</h2>
        <div className="mt-3">
          <InviteAdminForm />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium">管理者一覧</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            管理者がいません。
          </p>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.display_name ?? r.email ?? r.id.slice(0, 8)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.email ?? "—"}
                    {r.createdAt
                      ? `　${new Date(r.createdAt).toLocaleDateString("ja-JP", {
                          timeZone: "Asia/Tokyo",
                        })}`
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                    r.confirmed
                      ? "border"
                      : "bg-amber-500/15 text-amber-700"
                  }`}
                >
                  {r.confirmed ? "有効" : "招待中"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
