import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { AdminSidebarLink } from "./_components/sidebar-link";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="flex h-svh">
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="border-b p-4">
          <Link href="/admin" className="text-sm font-semibold tracking-wide">
            BECOS OEM
          </Link>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Admin
          </p>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          <AdminSidebarLink href="/admin/orders">注文一覧</AdminSidebarLink>
          <AdminSidebarLink href="/admin/templates">テンプレ</AdminSidebarLink>
        </nav>
        <div className="border-t p-3">
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {profile?.display_name ?? user.email}
          </p>
          <form action={signOut} className="mt-2">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              ログアウト
            </Button>
          </form>
        </div>
      </aside>

      {/* Mobile: top bar with simple title */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
          <Link href="/admin" className="text-sm font-semibold">
            BECOS OEM Admin
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              ログアウト
            </Button>
          </form>
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
