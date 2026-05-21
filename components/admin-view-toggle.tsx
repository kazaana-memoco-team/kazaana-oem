"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Segmented toggle shown only to admin users, letting them switch between
 * the customer-facing shop and the admin dashboard.
 */
export function AdminViewToggle() {
  const pathname = usePathname();
  const inAdmin = pathname.startsWith("/admin");

  return (
    <div className="inline-flex items-center rounded-full border bg-background p-0.5 text-xs">
      <Link
        href="/"
        className={`rounded-full px-3 py-1 transition-colors ${
          inAdmin
            ? "text-muted-foreground hover:text-foreground"
            : "bg-foreground text-background"
        }`}
      >
        ショップ
      </Link>
      <Link
        href="/admin"
        className={`rounded-full px-3 py-1 transition-colors ${
          inAdmin
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        管理画面
      </Link>
    </div>
  );
}
