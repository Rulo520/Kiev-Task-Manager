import { createClient } from "@/lib/supabase/server";

export type GHLUser = {
  id: string; // Internal Supabase ID
  ghl_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "agency" | "client";
  location_id: string | null;
  company_name: string | null;
  profile_pic: string | null;
};

/**
 * Utility to get the current authenticated user from the Request headers/cookies.
 * Support standard GHL parameters: user_id, userId, contact_id, contactId.
 */
export async function getAuthUser(req: Request): Promise<GHLUser | null> {
  const url = new URL(req.url);
  
  // GHL standard parameters (Support various casings used by GHL)
  const ghlUserId = 
    url.searchParams.get("userId") || 
    url.searchParams.get("user_id") || 
    url.searchParams.get("contactId") ||
    url.searchParams.get("contact_id") ||
    req.headers.get("x-ghl-user-id") ||
    req.headers.get("x-ghl-contact-id");

  const testUserId = url.searchParams.get("testUser") || req.headers.get("x-test-user");

  // V13.1 - Cookie Session Support
  const cookieHeader = req.headers.get("cookie") || "";
  const kievSession = cookieHeader.split("; ").find(c => c.startsWith("kiev_user_id="))?.split("=")[1];

  // Identification priority: 1. x-test-user (internal), 2. Cookie (Session), 3. GHL identity (Params)
  const targetId = testUserId || kievSession || ghlUserId;

  if (!targetId) return null;



  const supabase = await createClient();

  // 1. Try finding by internal ID or GHL ID or Email
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .or(`id.eq."${targetId}",ghl_user_id.eq."${targetId}",email.eq."${targetId}"`)
    .single();

  if (!error && user) {
    return user as GHLUser;
  }

  // NO FALLBACKS ALLOWED IN V7.0 (Strict Enforcement)
  return null;
}
