import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveUser } from "@/lib/ghl/resolveUser";

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface GHLUserRaw {
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
    const ghlIdSearch = searchParams.get("ghl_id");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Faltan variables de Supabase configuradas." },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // --- MODE A: Single GHL ID resolution (staff or contact) ---
    if (ghlIdSearch) {
      const resolved = await resolveUser(ghlIdSearch);
      if (!resolved) {
        return NextResponse.json({ error: "GHL ID no reconocido." }, { status: 404 });
      }
      return NextResponse.json({ user: resolved });
    }

    // --- MODE B: Search by Email ---
    if (emailSearch) {
      const { data: userData, error: searchError } = await supabase
        .from("users")
        .select("*")
        .eq("email", emailSearch)
        .maybeSingle();

      if (searchError || !userData) {
        return NextResponse.json(
          { error: "Email no encontrado o no autorizado en Kiev." },
          { status: 404 }
        );
      }

      return NextResponse.json([userData]);
    }

    // --- MODE C: Full GHL Agency Sync ---
    if (!GHL_ACCESS_TOKEN || !GHL_COMPANY_ID) {
      // No GHL creds — return existing DB users only
      const { data: existingUsers } = await supabase
        .from("users")
        .select("*")
        .eq("role", "agency");
      return NextResponse.json({ users: existingUsers || [] });
    }

    const url = new URL("https://services.leadconnectorhq.com/users/search");
    url.searchParams.append("companyId", GHL_COMPANY_ID);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GHL_ACCESS_TOKEN}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GHL API responded with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const allUsers = (data.users || []) as GHLUserRaw[];

    if (allUsers.length > 0) {
      const upsertPromises = allUsers.map((u: GHLUserRaw) => {
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
      await Promise.all(upsertPromises);
    }

    const { data: agencyUsers } = await supabase
      .from("users")
      .select("*")
      .eq("role", "agency");

    return NextResponse.json({
      users: agencyUsers,
      total_synced: allUsers.length,
      agency_count: agencyUsers?.length ?? 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GHL Users API Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
