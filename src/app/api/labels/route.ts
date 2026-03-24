import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const testUserId = request.headers.get("x-test-user");

  if (!locationId && !testUserId) {
    return NextResponse.json({ error: "Location ID required" }, { status: 400 });
  }

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("labels")
    .select("*")
    .eq("location_id", locationId || "test-location-id") // Fallback for dev
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, color, locationId } = body;

  if (!name || !color) {
    return NextResponse.json({ error: "Name and Color required" }, { status: 400 });
  }

  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("labels")
    .insert([{ 
      name, 
      color, 
      location_id: locationId || "test-location-id" 
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
