import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GHL_ACCESS_TOKEN = process.env.GHL_ACCESS_TOKEN;
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") === "1";

  try {
    if (!GHL_ACCESS_TOKEN || !GHL_COMPANY_ID) {
      return NextResponse.json(
        { error: "Faltan variables en Vercel: necesitás GHL_ACCESS_TOKEN (token de Agencia) y GHL_COMPANY_ID (ID de tu Agencia en GHL)." },
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

    const rawText = await response.text();
    console.log("GHL status:", response.status);
    console.log("GHL raw response:", rawText.slice(0, 1000));

    if (!response.ok) {
      throw new Error(`GHL API responded with status ${response.status}: ${rawText}`);
    }

    const data = JSON.parse(rawText);

    // Debug mode: return full raw response for inspection
    if (debug) {
      return NextResponse.json({ 
        status: response.status,
        keys: Object.keys(data),
        raw: data
      });
    }

    // Try multiple possible keys the search endpoint might use
    const users = data.users || data.data || data.results || (Array.isArray(data) ? data : []);

    if (users.length === 0) {
      return NextResponse.json(
        { error: "GHL devolvió 0 usuarios. Verificá que GHL_COMPANY_ID sea correcto y que el token sea de nivel Agencia (no de subcuenta)." },
        { status: 200 }
      );
    }

    const supabase = await createClient();

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
