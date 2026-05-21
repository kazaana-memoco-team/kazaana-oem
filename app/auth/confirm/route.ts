import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Verifies a Supabase auth link (invite / recovery / email change).
 * On success a session cookie is set and we redirect to `next`.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") || "/account";

  if (!tokenHash || !type) {
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
