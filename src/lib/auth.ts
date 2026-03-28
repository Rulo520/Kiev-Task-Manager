import { createClient } from "@/lib/supabase/server";
import { resolveUser } from "@/lib/ghl/resolveUser";

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

  // V20.0 - Capture current location context
  const explicitLocationId = 
    url.searchParams.get("locationId") || 
    url.searchParams.get("location_id") || 
    req.headers.get("x-ghl-location-id");

  const testUserId = url.searchParams.get("testUser") || req.headers.get("x-test-user");

  // V13.1 - Cookie Session Support
  const cookieHeader = req.headers.get("cookie") || "";
  const kievSession = cookieHeader.split("; ").find(c => c.startsWith("kiev_user_id="))?.split("=")[1];

  // Identification priority: 1. x-test-user (internal), 2. Cookie (Session), 3. GHL identity (Params)
  const targetId = testUserId || kievSession || ghlUserId;

  if (!targetId) return null;

  // V20.0 - Use resolveUser for dynamic context switching and sync
  // This will handle case where users switch locations (isDifferentContext check)
  try {
    const user = await resolveUser(targetId, undefined, explicitLocationId || undefined);
    if (user) return user as GHLUser;
    
    // Fallback if resolveUser returns null (e.g. unknown GHL ID but exists in DB)
    const supabase = await createClient();
    const { data: dbUser } = await supabase
      .from("users")
      .select("*")
      .or(`id.eq."${targetId}",ghl_user_id.eq."${targetId}",email.eq."${targetId}"`)
      .maybeSingle();
      
    return dbUser as GHLUser | null;
  } catch (err) {
    console.error("[getAuthUser] Resolution error:", err);
    const supabase = await createClient();
    const { data: dbUser } = await supabase
      .from("users")
      .select("*")
      .or(`id.eq."${targetId}",ghl_user_id.eq."${targetId}",email.eq."${targetId}"`)
      .maybeSingle();
    return dbUser as GHLUser | null;
  }
}
