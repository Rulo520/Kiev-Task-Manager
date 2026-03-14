import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export async function GET(req: Request) {
  try {
    if (!GHL_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "GHL_ACCESS_TOKEN is not configured on the server." },
        { status: 500 }
      );
    }

    // Call GHL v2 API (LeadConnector) to fetch users
    // According to GHL Docs V2:
    // - Agency Level uses: /users/search?companyId=...
    // - Location Level uses: /users/?locationId=...
    let urlString = "https://services.leadconnectorhq.com/users/";
    
    if (GHL_COMPANY_ID) {
      urlString = "https://services.leadconnectorhq.com/users/search";
    }

    const url = new URL(urlString);
    
    if (GHL_COMPANY_ID) {
      url.searchParams.append("companyId", GHL_COMPANY_ID);
    } else if (GHL_LOCATION_ID) {
      url.searchParams.append("locationId", GHL_LOCATION_ID);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${GHL_ACCESS_TOKEN}`,
        "Version": "2021-07-28", // Required Version header for GHL v2
        "Accept": "application/json"
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GHL API Error Response:", errorText);
      throw new Error(`GHL API responded with status ${response.status}`);
    }

    const data = await response.json();
    // Log the raw response for debugging
    console.log("GHL raw response keys:", Object.keys(data));
    console.log("GHL raw response:", JSON.stringify(data).slice(0, 500));
    
    // GHL /users/search may return users under different keys
    // Try 'users', 'data', 'contacts', or direct array
    const users = data.users || data.data || data.results || (Array.isArray(data) ? data : []);
    console.log("Users found:", users.length);

    const supabase = await createClient();

    try {
      // Sync users to our database
      const upsertPromises = users.map((u: any) =>
        supabase.from("users").upsert(
          {
            ghl_user_id: u.id,
            email: u.email,
            first_name: u.firstName || u.name?.split(' ')[0] || '',
            last_name: u.lastName || u.name?.split(' ').slice(1).join(' ') || '',
            role: "agency", // All fetched staff are agency members
            profile_pic: u.profilePhoto || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "ghl_user_id" }
        )
      );

      await Promise.all(upsertPromises);

      // Fetch the updated, normalized users from our database to return to the frontend
      const { data: syncedUsers, error: dbError } = await supabase
        .from("users")
        .select("*")
        .eq("role", "agency");

      if (dbError) throw dbError;

      return NextResponse.json({ users: syncedUsers });
    } catch (dbError: any) {
      console.error("Supabase Sync Error:", dbError);
      return NextResponse.json(
        { error: "Failed to save users to database: " + dbError.message },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("Fetch GHL Users Error:", error);
    return NextResponse.json(
      { error: `GHL API Error: ${error.message || "Unknown error"}` },
      { status: 500 }
    );
  }
}
