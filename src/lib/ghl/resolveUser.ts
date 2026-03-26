import { getAdminClient } from "@/lib/supabase/admin";
import type { GHLUser } from "@/lib/auth";

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_API_VERSION = "2021-07-28";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function ghlHeaders() {
  return {
    Authorization: `Bearer ${GHL_ACCESS_TOKEN}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function fetchGHLStaffUser(ghlUserId: string): Promise<GHLUser | null> {
  try {
    const res = await fetch(`${GHL_API_BASE}/users/${ghlUserId}`, {
      headers: ghlHeaders(),
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;

    const data = await res.json();

    return {
      id: "", // Filled after DB upsert
      ghl_user_id: data.id,
      email: data.email || "",
      first_name: data.firstName || data.name?.split(" ")[0] || "",
      last_name: data.lastName || data.name?.split(" ").slice(1).join(" ") || "",
      // V12.9: Dynamically map GHL user types to our internal roles
      // Agency-level users -> "agency"
      // Sub-account (Location) level users -> "client"
      role: data.roles?.type === "agency" ? "agency" : "client",
      location_id: data.locationId || null,
      profile_pic: data.profilePhoto || null,
    };
  } catch {
    return null;
  }
}

async function fetchGHLContact(ghlContactId: string): Promise<GHLUser | null> {
  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/${ghlContactId}`, {
      headers: ghlHeaders(),
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const contact = data.contact || data;

    return {
      id: "", // Filled after DB upsert
      ghl_user_id: contact.id,
      email: contact.email || "",
      first_name: contact.firstName || contact.name?.split(" ")[0] || "Contacto",
      last_name: contact.lastName || contact.name?.split(" ").slice(1).join(" ") || "",
      role: "client",
      location_id: contact.locationId || null,
      profile_pic: null,
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// Main export: resolveUser
//
// Given a raw GHL ID (which can be either a userId or a contactId),
// this function:
//   1. Tries to find the user in Supabase (fast path / cache check)
//   2. If not found, tries GHL /users/{id} (agency staff)
//   3. If not a staff user, tries GHL /contacts/{id} (client contact)
//   4. Upserts the result into Supabase and returns the User
//   5. Returns null if GHL doesn't recognize the ID either
// ------------------------------------------------------------------

export async function resolveUser(ghlId: string, preferredRole?: "agency" | "client"): Promise<GHLUser | null> {
  if (!ghlId) return null;

  const supabase = getAdminClient();

  // 1. First, find if they exist by GHL ID or Email (Avoid UUID type errors on ID column)
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .or(`ghl_user_id.eq.${ghlId},email.eq.${ghlId}`)
    .maybeSingle();

  // If found and the role matches, we can use the fast path (unless it's stake)
  if (existingUser && (!preferredRole || existingUser.role === preferredRole)) {
    const lastUpdated = new Date(existingUser.updated_at || 0).getTime();
    if (Date.now() - lastUpdated > 24 * 60 * 60 * 1000 && GHL_ACCESS_TOKEN) {
      refreshUserInBackground(existingUser.ghl_user_id, existingUser.role);
    }
    return existingUser as GHLUser;
  }

  // 2. Not found OR role mismatch — ask GHL
  if (!GHL_ACCESS_TOKEN) return existingUser ? (existingUser as GHLUser) : null;

  let ghlProfile: GHLUser | null = null;
  if (preferredRole === "client") {
    ghlProfile = await fetchGHLContact(ghlId);
    if (!ghlProfile) ghlProfile = await fetchGHLStaffUser(ghlId);
  } else {
    ghlProfile = await fetchGHLStaffUser(ghlId);
    if (!ghlProfile) ghlProfile = await fetchGHLContact(ghlId);
  }

  if (!ghlProfile) return existingUser ? (existingUser as GHLUser) : null;

  // 3. Save the findings
  // If user existed, we UPDATE specifically to avoid conflicts and ensure role change
  if (existingUser) {
    const { data: updated, error } = await supabase
      .from("users")
      .update({
        ghl_user_id: ghlProfile.ghl_user_id,
        email: ghlProfile.email,
        first_name: ghlProfile.first_name,
        last_name: ghlProfile.last_name,
        role: ghlProfile.role, // Force the correct role from GHL
        location_id: ghlProfile.location_id,
        profile_pic: ghlProfile.profile_pic,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingUser.id)
      .select()
      .single();

    if (error) {
      console.error("[resolveUser] Update failed:", error.message);
      return existingUser as GHLUser;
    }
    return updated as GHLUser;
  }

  // If new, we INSERT (original behavior)
  const { data: inserted, error } = await supabase
    .from("users")
    .insert([{
      ghl_user_id: ghlProfile.ghl_user_id,
      email: ghlProfile.email,
      first_name: ghlProfile.first_name,
      last_name: ghlProfile.last_name,
      role: ghlProfile.role,
      location_id: ghlProfile.location_id,
      profile_pic: ghlProfile.profile_pic,
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) {
    // If insert fails (maybe concurrent?), try one last lookup
    const { data: finalRetry } = await supabase
      .from("users")
      .select("*")
      .eq("ghl_user_id", ghlProfile.ghl_user_id)
      .maybeSingle();
    return (finalRetry as GHLUser) || null;
  }

  return inserted as GHLUser;
}

// ------------------------------------------------------------------
// Background refresh helper (fire-and-forget)
// ------------------------------------------------------------------

async function refreshUserInBackground(ghlUserId: string, role: string): Promise<void> {
  try {
    const supabase = getAdminClient();
    const fetcher = role === "agency" ? fetchGHLStaffUser : fetchGHLContact;
    const fresh = await fetcher(ghlUserId);

    if (fresh) {
      await supabase
        .from("users")
        .update({
          email: fresh.email,
          first_name: fresh.first_name,
          last_name: fresh.last_name,
          profile_pic: fresh.profile_pic,
          location_id: fresh.location_id,
          updated_at: new Date().toISOString(),
        })
        .eq("ghl_user_id", ghlUserId);
    }
  } catch (e) {
    // Never block the render — just log silently
    console.warn("[resolveUser] Background refresh failed:", e);
  }
}
