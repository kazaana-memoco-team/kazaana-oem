"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminSidebarLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active =
    pathname === href || (href !== "/admin" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
