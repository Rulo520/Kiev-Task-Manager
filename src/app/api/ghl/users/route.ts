import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface GHLUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  roles?: { type: string };
  profilePhoto?: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const emailSearch = searchParams.get("email");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Faltan variables de Supabase configuradas." },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // --- GATEKEEPER MODE: Search by Email ---
    if (emailSearch) {
      const { data: userData, error: searchError } = await supabase
        .from("users")
        .select("*")
        .eq("email", emailSearch)
        .maybeSingle();
      
      if (searchError || !userData) {
        return NextResponse.json({ error: "Usuario no autorizado o no encontrado en Kiev." }, { status: 404 });
      }
      return NextResponse.json([userData]);
    }

    // --- SYNC MODE: GHL to Supabase ---
    if (!GHL_ACCESS_TOKEN || !GHL_COMPANY_ID) {
      // If no GHL creds, we still return the existing users for the UI assignment dropdown
      const { data: existingUsers } = await supabase.from("users").select("*").eq("role", "agency");
      return NextResponse.json({ users: existingUsers || [] });
    }

    const url = new URL("https://services.leadconnectorhq.com/users/search");
    url.searchParams.append("companyId", GHL_COMPANY_ID);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${GHL_ACCESS_TOKEN}`,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GHL API responded with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const allUsers = (data.users || []) as GHLUser[];

    if (allUsers.length > 0) {
      const upsertPromises = allUsers.map((u: GHLUser) => {
        const isAgencyUser = u.roles?.type === "agency";
        return supabase.from("users").upsert({
          ghl_user_id: u.id,
          email: u.email,
          first_name: u.firstName || u.name?.split(" ")[0] || "",
          last_name: u.lastName || u.name?.split(" ").slice(1).join(" ") || "",
          role: isAgencyUser ? "agency" : "client",
          profile_pic: u.profilePhoto || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "ghl_user_id" });
      });
      await Promise.all(upsertPromises);
    }

    const { data: agencyUsers } = await supabase.from("users").select("*").eq("role", "agency");

    return NextResponse.json({ 
      users: agencyUsers,
      total_synced: allUsers.length,
      agency_count: agencyUsers?.length ?? 0
    });

  } catch (error: any) {
    console.error("GHL Users API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
