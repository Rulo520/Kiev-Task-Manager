import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export async function GET() {
  try {
    if (!GHL_ACCESS_TOKEN || !GHL_LOCATION_ID) {
      return NextResponse.json(
        { error: "GHL_ACCESS_TOKEN or GHL_LOCATION_ID are not configured on the server." },
        { status: 500 }
      );
    }

    // GHL v2 (LeadConnector) - Location-level user fetch
    // Private Integration tokens are scoped to a Location, so we use:
    // GET /users/?locationId=...
    const url = new URL("https://services.leadconnectorhq.com/users/");
    url.searchParams.append("locationId", GHL_LOCATION_ID);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        // GHL Private Integration tokens are sent WITHOUT "Bearer" prefix
        "Authorization": GHL_ACCESS_TOKEN,
        "Version": "2021-07-28",
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GHL API Error:", response.status, errorText);
      throw new Error(`GHL API responded with status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const users = data.users || [];

    if (users.length === 0) {
      return NextResponse.json(
        { error: "La API de GHL devolvió 0 usuarios. Verifica que GHL_LOCATION_ID sea correcto y que el token tenga el scope 'Users > Read'." },
        { status: 200 }
      );
    }

    const supabase = await createClient();

    // Sync users into Supabase
    const upsertPromises = users.map((u: any) =>
      supabase.from("users").upsert(
        {
          ghl_user_id: u.id,
          email: u.email,
          first_name: u.firstName || u.name?.split(" ")[0] || "",
          last_name: u.lastName || u.name?.split(" ").slice(1).join(" ") || "",
          role: "agency",
          profile_pic: u.profilePhoto || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ghl_user_id" }
      )
    );

    await Promise.all(upsertPromises);

    const { data: syncedUsers, error: dbError } = await supabase
      .from("users")
      .select("*")
      .eq("role", "agency");

    if (dbError) throw dbError;

    return NextResponse.json({ users: syncedUsers });

  } catch (error: any) {
    console.error("GHL Users Sync Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync GHL users." },
      { status: 500 }
    );
  }
}
