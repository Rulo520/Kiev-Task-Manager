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
      role: "agency",
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

export async function resolveUser(ghlId: string): Promise<GHLUser | null> {
  if (!ghlId) return null;

  const supabase = getAdminClient();

  // 1. Check Supabase first (fast path — avoids GHL API calls on repeat visits)
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .or(`id.eq."${ghlId}",ghl_user_id.eq."${ghlId}",email.eq."${ghlId}"`)
    .maybeSingle();

  if (existingUser) {
    // Silently refresh stale records (older than 24h) without blocking the render
    const lastUpdated = new Date(existingUser.updated_at || 0).getTime();
    const isStale = Date.now() - lastUpdated > 24 * 60 * 60 * 1000;

    if (isStale && GHL_ACCESS_TOKEN) {
      // Fire-and-forget background refresh
      refreshUserInBackground(existingUser.ghl_user_id, existingUser.role);
    }

    return existingUser as GHLUser;
  }

  // 2. Not in DB yet — ask GHL (requires real credentials)
  if (!GHL_ACCESS_TOKEN) {
    console.warn("[resolveUser] GHL_ACCESS_TOKEN not set — cannot resolve unknown user from GHL.");
    return null;
  }

  // 3. Try as agency staff first
  let ghlProfile = await fetchGHLStaffUser(ghlId);

  // 4. Fall back to contact if not found as staff
  if (!ghlProfile) {
    ghlProfile = await fetchGHLContact(ghlId);
  }

  if (!ghlProfile) {
    console.warn(`[resolveUser] GHL does not recognize ID: ${ghlId}`);
    return null;
  }

  // 5. Upsert into Supabase
  const { data: upserted, error } = await supabase
    .from("users")
    .upsert(
      {
        ghl_user_id: ghlProfile.ghl_user_id,
        email: ghlProfile.email,
        first_name: ghlProfile.first_name,
        last_name: ghlProfile.last_name,
        role: ghlProfile.role,
        location_id: ghlProfile.location_id,
        profile_pic: ghlProfile.profile_pic,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "ghl_user_id" }
    )
    .select()
    .single();

  if (error || !upserted) {
    console.error("[resolveUser] Supabase upsert failed:", error?.message);
    return null;
  }

  console.log(`[resolveUser] ✅ New user resolved & saved: ${upserted.first_name} ${upserted.last_name} (${upserted.role})`);
  return upserted as GHLUser;
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
