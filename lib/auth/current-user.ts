import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

/**
 * Fetch the current auth user + their profile role in one place.
 * Returns nulls when not logged in.
 */
export async function getCurrentUserWithRole(): Promise<{
  userId: string | null;
  email: string | null;
  role: UserRole | null;
  displayName: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { userId: null, email: null, role: null, displayName: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile?.role ?? null,
    displayName: profile?.display_name ?? null,
  };
}
