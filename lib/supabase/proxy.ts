import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types/database";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/api/shopify/webhook"];

const ROLE_PROTECTED_PATHS: Array<{
  prefix: string;
  allowedRoles: Array<"customer" | "craftsman" | "admin">;
}> = [
  { prefix: "/account", allowedRoles: ["customer", "craftsman", "admin"] },
  { prefix: "/craftsman", allowedRoles: ["craftsman", "admin"] },
  { prefix: "/admin", allowedRoles: ["admin"] },
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  const isPublic =
    PUBLIC_PATHS.includes(path) ||
    path.startsWith("/_next") ||
    path.startsWith("/api/shopify/");

  const protectedMatch = ROLE_PROTECTED_PATHS.find((rule) =>
    path.startsWith(rule.prefix),
  );

  if (!user && protectedMatch && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user && protectedMatch) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role;
    if (!role || !protectedMatch.allowedRoles.includes(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
