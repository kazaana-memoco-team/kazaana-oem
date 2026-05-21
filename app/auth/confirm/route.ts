import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// OTP link types this endpoint is allowed to verify. Anything else is rejected
// rather than forwarded to Supabase (defends against misuse of the endpoint).
const ALLOWED_TYPES: EmailOtpType[] = [
  "invite",
  "recovery",
  "magiclink",
  "email",
];

/**
 * Only allow same-origin redirect targets. `next` arrives via an emailed link
 * (untrusted), so reject anything that isn't a plain internal path — including
 * protocol-relative (`//host`, `/\host`) values that `new URL()` resolves
 * off-site.
 */
function safeNext(raw: string | null): string {
  const fallback = "/account";
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}

/**
 * Verifies a Supabase auth link (invite / recovery / email change).
 * On success a session cookie is set and we redirect to `next`.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_link", url.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("link_expired")}`,
        url.origin,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
