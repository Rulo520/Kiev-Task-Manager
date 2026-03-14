import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GHL_API_KEY = process.env.GHL_API_KEY;

export async function GET(req: Request) {
  try {
    if (!GHL_API_KEY) {
      return NextResponse.json(
        { error: "GHL_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    // Call GHL v1 API to fetch users for the location
    // Note: If using v2, the URL and Headers change (Requires Bearer token and Version header).
    // Using v1 structure for Location API Key:
    const response = await fetch("https://rest.gohighlevel.com/v1/users/", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${GHL_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`GHL API responded with status ${response.status}`);
    }

    const data = await response.json();
    const users = data.users || [];

    const supabase = await createClient();

    // Sync users to our database
    const upsertPromises = users.map((u: any) =>
      supabase.from("users").upsert(
        {
          ghl_user_id: u.id,
          email: u.email,
          first_name: u.firstName,
          last_name: u.lastName,
          role: "agency", // All fetched staff are agency members
          profile_pic: u.profilePhoto || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "ghl_user_id" }
      )
    );

    await Promise.all(upsertPromises);

    // Fetch the updated, normalized users from our database to return to the frontend
    const { data: syncedUsers, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "agency");

    if (error) throw error;

    return NextResponse.json({ users: syncedUsers });

  } catch (error: any) {
    console.error("Fetch GHL Users Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch and sync GHL users" },
      { status: 500 }
    );
  }
}
