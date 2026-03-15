import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;

export async function GET() {
  try {
    if (!GHL_ACCESS_TOKEN || !GHL_COMPANY_ID) {
      return NextResponse.json(
        { error: "Faltan variables en Vercel: GHL_ACCESS_TOKEN y GHL_COMPANY_ID son requeridos." },
        { status: 500 }
      );
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
    const allUsers = data.users || [];

    if (allUsers.length === 0) {
      return NextResponse.json(
        { error: `GHL devolvió 0 usuarios para la compañía ${GHL_COMPANY_ID}. Revisá que el token de agencia sea correcto.` },
        { status: 200 }
      );
    }

    const supabase = await createClient();

    // Sync phase
    const upsertPromises = allUsers.map((u: any) => {
      // In the debug dump we saw u.roles.type can be "agency" or "account"
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
    const errors = results.filter(r => r.error);
    
    if (errors.length > 0) {
      console.error("Supabase Upsert Errors:", errors[0].error);
      // If we have errors, it might be due to RLS or schema issues
      return NextResponse.json({ 
        error: `Error al guardar en base de datos: ${errors[0].error?.message}. Posiblemente RLS esté activo.`,
        details: errors[0].error
      }, { status: 500 });
    }

    // Final fetch for the frontend
    const { data: agencyUsers, error: dbError } = await supabase
      .from("users")
      .select("*")
      .eq("role", "agency");

    if (dbError) throw dbError;

    return NextResponse.json({ 
      users: agencyUsers,
      total_synced: allUsers.length,
      agency_count: agencyUsers?.length ?? 0
    });

  } catch (error: any) {
    console.error("GHL Users Sync Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync GHL users." },
      { status: 500 }
    );
  }
}
