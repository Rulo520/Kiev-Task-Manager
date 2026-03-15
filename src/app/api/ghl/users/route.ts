import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use SERVICE_ROLE_KEY to bypass RLS for server-side syncing
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

export async function GET() {
  try {
    if (!GHL_ACCESS_TOKEN || !GHL_COMPANY_ID) {
      return NextResponse.json(
        { error: "Faltan variables en Vercel: GHL_ACCESS_TOKEN y GHL_COMPANY_ID son requeridos." },
        { status: 500 }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Faltan variables de Supabase configuradas." },
        { status: 500 }
      );
    }

    // Initialize a dedicated server-side client that can bypass RLS 
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

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

    if (allUsers.length === 0) {
      return NextResponse.json(
        { error: `GHL devolvió 0 usuarios para la compañía ${GHL_COMPANY_ID}.` },
        { status: 200 }
      );
    }

    // Sync phase using the elevated permissions client
    const upsertPromises = allUsers.map((u: GHLUser) => {
      const isAgencyUser = u.roles?.type === "agency";
      return supabase.from("users").upsert(
        {
          ghl_user_id: u.id,
          email: u.email,
          first_name: u.firstName || u.name?.split(" ")[0] || "",
          last_name: u.lastName || u.name?.split(" ").slice(1).join(" ") || "",
          role: isAgencyUser ? "agency" : "client",
          profile_pic: u.profilePhoto || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ghl_user_id" }
      );
    });

    const results = await Promise.all(upsertPromises);
    const dbErrors = results.filter(r => r.error);
    
    if (dbErrors.length > 0) {
      console.error("Supabase Upsert Error:", dbErrors[0].error);
      const isRLS = dbErrors[0].error?.message?.includes("row-level security");
      return NextResponse.json({ 
        error: isRLS 
          ? "Permiso denegado en Supabase (RLS). Por favor, agrega la variable 'SUPABASE_SERVICE_ROLE_KEY' en Vercel." 
          : `Error de base de datos: ${dbErrors[0].error?.message}`
      }, { status: 500 });
    }

    // Final fetch for the frontend
    const { data: agencyUsers, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("role", "agency");

    if (fetchError) throw fetchError;

    return NextResponse.json({ 
      users: agencyUsers,
      total_synced: allUsers.length,
      agency_count: agencyUsers?.length ?? 0
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error("GHL Users Sync Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to sync GHL users." },
      { status: 500 }
    );
  }
}
