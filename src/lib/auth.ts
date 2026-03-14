import { createClient } from "@/lib/supabase/server";

export type GHLUser = {
  id: string; // Internal Supabase ID
  ghl_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "agency" | "client";
  profile_pic: string | null;
};

/**
 * Utility to get the current authenticated user from the Request headers/cookies.
 * In a real GHL Custom Menu Link environment, we'd receive an SSO token or URL parameters.
 * For this implementation, we will mock the verification and return the mapped Supabase user.
 */
export async function getAuthUser(req: Request): Promise<GHLUser | null> {
  const url = new URL(req.url);
  // Example: GHL might pass ?sessionkey=... or we use Cookies via Next.js
  // For development/mocking, we can pass a test user ID in headers or query params
  const testUserId = url.searchParams.get("testUser") || req.headers.get("x-test-user");

  if (!testUserId) {
    return null; // Not authenticated
  }

  const supabase = await createClient();

  // Fetch from our Database to enforce roles
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", testUserId)
    .single();

  if (error || !user) {
    console.error("Auth Error:", error);
    return null;
  }

  return user as GHLUser;
}
