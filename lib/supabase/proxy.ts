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

/**
 * Optional Basic Auth gate. Active only when BASIC_AUTH_USER/PASS are set.
 * Bypassed for Shopify webhooks (HMAC-authenticated) and Next.js internals.
 */
function checkBasicAuth(request: NextRequest): NextResponse | null {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return null;

  const path = request.nextUrl.pathname;
  // Skip for endpoints that get authenticated by other means
  if (path.startsWith("/api/shopify/webhook")) return null;
  if (path.startsWith("/_next") || path === "/favicon.ico") return null;

  const auth = request.headers.get("authorization");
  const expected = `Basic ${btoa(`${user}:${pass}`)}`;
  if (auth === expected) return null;

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="BECOS OEM"',
    },
  });
}

export async function updateSession(request: NextRequest) {
  const basicAuthResponse = checkBasicAuth(request);
  if (basicAuthResponse) return basicAuthResponse;

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
