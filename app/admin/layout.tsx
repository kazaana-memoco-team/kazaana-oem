import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

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
    <div className="flex h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full items-center justify-between px-4 py-3 md:px-8 lg:px-12">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-base font-semibold">
              BECOS OEM Admin
            </Link>
            <nav className="hidden gap-4 sm:flex">
              <Link
                href="/admin/orders"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                注文
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {profile?.display_name ?? user.email}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                ログアウト
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
