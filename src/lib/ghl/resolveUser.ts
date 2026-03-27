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

async function fetchLocationName(locationId: string): Promise<string | null> {
  if (!locationId || !GHL_ACCESS_TOKEN) return null;
  try {
    const res = await fetch(`${GHL_API_BASE}/locations/${locationId}`, {
      headers: ghlHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.location?.name || data.name || null;
  } catch {
    return null;
  }
}

async function fetchGHLStaffUser(ghlUserId: string): Promise<any | null> {
  try {
    const res = await fetch(`${GHL_API_BASE}/users/${ghlUserId}`, {
      headers: ghlHeaders(),
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const company_name = data.locationId ? await fetchLocationName(data.locationId) : null;

    return {
      ghl_user_id: data.id,
      email: data.email || "",
      first_name: data.firstName || data.name?.split(" ")[0] || "",
      last_name: data.lastName || data.name?.split(" ").slice(1).join(" ") || "",
      role: data.roles?.type === "agency" ? "agency" : "client",
      location_id: data.locationId || null,
      company_name: company_name,
      profile_pic: data.profilePhoto || null,
    };
  } catch {
    return null;
  }
}

async function fetchGHLContact(ghlContactId: string): Promise<any | null> {
  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/${ghlContactId}`, {
      headers: ghlHeaders(),
      next: { revalidate: 0 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const contact = data.contact || data;
    const company_name = contact.locationId ? await fetchLocationName(contact.locationId) : null;

    return {
      ghl_user_id: contact.id,
      email: contact.email || "",
      first_name: contact.firstName || contact.name?.split(" ")[0] || "Contacto",
      last_name: contact.lastName || contact.name?.split(" ").slice(1).join(" ") || "",
      role: "client",
      location_id: contact.locationId || null,
      company_name: company_name,
      profile_pic: null,
    };
  } catch {
    return null;
  }
}

export async function resolveUser(
  ghlId: string, 
  preferredRole?: "agency" | "client",
  explicitLocationId?: string
): Promise<any | null> {
  if (!ghlId) return null;

  const supabase = getAdminClient();

  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .or(`ghl_user_id.eq.${ghlId},email.eq.${ghlId}`)
    .maybeSingle();

  // V19.4 - Detect Context Changes (Multi-client support)
  // If the location specified in the URL corresponds to a different client, we must force re-resolution
  // even if the user record exists, to update the dynamic company_name for branding.
  const isMissingData = !existingUser?.company_name && explicitLocationId;
  const isDifferentContext = explicitLocationId && existingUser?.location_id !== explicitLocationId;

  if (existingUser && (!preferredRole || existingUser.role === preferredRole) && !isMissingData && !isDifferentContext) {
    const lastUpdated = new Date(existingUser.updated_at || 0).getTime();
    if (Date.now() - lastUpdated > 24 * 60 * 60 * 1000 && GHL_ACCESS_TOKEN) {
      refreshUserInBackground(existingUser.ghl_user_id, existingUser.role);
    }
    return existingUser;
  }

  if (!GHL_ACCESS_TOKEN) return existingUser || null;

  let ghlProfile: any | null = null;
  if (preferredRole === "client") {
    ghlProfile = await fetchGHLContact(ghlId);
    if (!ghlProfile) ghlProfile = await fetchGHLStaffUser(ghlId);
  } else {
    ghlProfile = await fetchGHLStaffUser(ghlId);
    if (!ghlProfile) ghlProfile = await fetchGHLContact(ghlId);
  }

  if (!ghlProfile) return existingUser || null;

  // For both new and existing users, resolve the company name if possible
  // V18.4 - If explicitLocationId is provided, ALWAYS fetch its name to use as current context
  let resolvedCompanyName = ghlProfile.company_name;
  if (explicitLocationId || (!resolvedCompanyName && ghlProfile.location_id)) {
    const locName = await fetchLocationName(explicitLocationId || ghlProfile.location_id);
    if (locName) resolvedCompanyName = locName;
  }

  if (existingUser) {
    // V18.4 - Use resolved name from GHL/URL, fallback to existing only if resolved is null
    const finalCompanyName = resolvedCompanyName || existingUser.company_name;

    const { data: updated, error } = await supabase
      .from("users")
      .update({
        ghl_user_id: ghlProfile.ghl_user_id,
        email: ghlProfile.email,
        first_name: ghlProfile.first_name,
        last_name: ghlProfile.last_name,
        role: ghlProfile.role,
        location_id: explicitLocationId || ghlProfile.location_id || existingUser.location_id,
        company_name: finalCompanyName,
        profile_pic: ghlProfile.profile_pic,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingUser.id)
      .select()
      .single();

    if (error) {
      console.error("[resolveUser] Update failed:", error.message);
      return existingUser;
    }
    return updated;
  }

  // New user logic
  const { data: inserted, error } = await supabase
    .from("users")
    .insert([{
      ghl_user_id: ghlProfile.ghl_user_id,
      email: ghlProfile.email,
      first_name: ghlProfile.first_name,
      last_name: ghlProfile.last_name,
      role: ghlProfile.role,
      location_id: ghlProfile.location_id || explicitLocationId,
      company_name: resolvedCompanyName,
      profile_pic: ghlProfile.profile_pic,
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) {
    const { data: finalRetry } = await supabase
      .from("users")
      .select("*")
      .eq("ghl_user_id", ghlProfile.ghl_user_id)
      .maybeSingle();
    return finalRetry || null;
  }

  return inserted;
}

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
          company_name: fresh.company_name,
          updated_at: new Date().toISOString(),
        })
        .eq("ghl_user_id", ghlUserId);
    }
  } catch (e) {
    console.warn("[resolveUser] Background refresh failed:", e);
  }
}

