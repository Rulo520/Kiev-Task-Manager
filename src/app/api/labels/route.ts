import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId") || user?.location_id || "test-location-id";

  if (!user && !searchParams.get("locationId")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  
  let query = supabase
    .from("labels")
    .select("*")
    .eq("location_id", locationId);

  // V21.0 - Hierarchical Visibility
  // Agency sees ALL labels. Client sees agency labels + their own.
  if (user && user.role === "client") {
    query = query.or(`created_by_role.eq.agency,created_by.eq.${user.id}`);
  }

  const { data, error } = await query.order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // V21.1 - Force No Cache for labels (Critical for consistency)
  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}


export async function POST(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, color, locationId } = body;

  if (!name || !color) {
    return NextResponse.json({ error: "Name and Color required" }, { status: 400 });
  }

  const supabase = await createClient();
  
  // V21.0 - Uniqueness Check (Case Insensitive)
  const { data: existing } = await supabase
    .from("labels")
    .select("id")
    .ilike("name", name)
    .single();

  if (existing) {
    return NextResponse.json({ 
      error: "Ya existe una etiqueta con este nombre. Por favor, elige uno diferente." 
    }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("labels")
    .insert([{ 
      name, 
      color, 
      location_id: locationId || user.location_id || "test-location-id",
      created_by: user.id,
      created_by_role: user.role
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const labelId = searchParams.get("id");
  const deleteAll = searchParams.get("all") === "true";
  const locationId = searchParams.get("locationId") || user.location_id;

  const supabase = await createClient();

  if (deleteAll && user.role === "agency") {
    // Master Reset (Agency only)
    const { error } = await supabase
      .from("labels")
      .delete()
      .eq("location_id", locationId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (!labelId) return NextResponse.json({ error: "Label ID required" }, { status: 400 });

  // Ownership Check
  const { data: label } = await supabase
    .from("labels")
    .select("created_by, created_by_role")
    .eq("id", labelId)
    .single();

  if (!label) return NextResponse.json({ error: "Label not found" }, { status: 404 });

  const canDelete = 
    user.role === "agency" || 
    (user.role === "client" && label.created_by === user.id);

  if (!canDelete) {
    return NextResponse.json({ error: "No tienes permiso para borrar esta etiqueta. Solo puedes borrar las tuyas." }, { status: 403 });
  }

  const { error } = await supabase
    .from("labels")
    .delete()
    .eq("id", labelId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
