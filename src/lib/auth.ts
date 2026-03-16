import { createClient } from "@/lib/supabase/server";

export type GHLUser = {
  id: string; // Internal Supabase ID
  ghl_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "agency" | "client";
  location_id: string | null;
  profile_pic: string | null;
};

/**
 * Utility to get the current authenticated user from the Request headers/cookies.
 * In a real GHL Custom Menu Link environment, we'd receive an SSO token or URL parameters.
 * For this implementation, we will mock the verification and return the mapped Supabase user.
 */
export async function getAuthUser(req: Request): Promise<GHLUser | null> {
  const url = new URL(req.url);
  
  // GHL standard parameters for Custom Menu Links
  const ghlUserId = url.searchParams.get("user_id") || req.headers.get("x-ghl-user-id");
  const testUserId = url.searchParams.get("testUser") || req.headers.get("x-test-user");
  const locationId = url.searchParams.get("location_id") || req.headers.get("x-ghl-location-id");

  // Identification priority: 1. x-test-user (internal), 2. GHL user_id, 3. Default dev 'Rulo'
  const targetId = testUserId || ghlUserId;

  const supabase = await createClient();

  if (targetId) {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", targetId)
      .single();

    if (!error && user) return user as GHLUser;
    
    // If it's a GHL ID but not in our DB yet, we could fetch from GHL API or just return a mock 
    // for this requirement stage. But for Rulo specifically, we'll favor the manual seed.
  }

  // DEFAULT FALLBACK FOR RULO (Development & Quick Testing)
  // We look for any user with first_name 'Rulo' to avoid 'Fabricio Leiva' takeover
  const { data: ruloUser } = await supabase
    .from("users")
    .select("*")
    .eq("first_name", "Rulo")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (ruloUser) return ruloUser as GHLUser;

  return null;
}
