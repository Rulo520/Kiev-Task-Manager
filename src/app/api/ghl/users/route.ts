import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;

export async function GET(req: Request) {
  try {
    if (!GHL_ACCESS_TOKEN || !GHL_COMPANY_ID) {
      return NextResponse.json(
        { error: "GHL_ACCESS_TOKEN or GHL_COMPANY_ID are not configured on the server." },
        { status: 500 }
      );
    }

    // Call GHL v2 API (LeadConnector) to fetch users for the agency (company)
    const url = new URL("https://services.leadconnectorhq.com/users/");
    url.searchParams.append("companyId", GHL_COMPANY_ID);

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
    // GHL v2 returns users array inside the top level object
    const users = data.users || [];

    const supabase = await createClient();

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

  } catch (error: any) {
    console.error("Fetch GHL Users Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch and sync GHL users. Ensure token is valid." },
      { status: 500 }
    );
  }
}

