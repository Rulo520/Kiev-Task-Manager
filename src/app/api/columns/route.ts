import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);

    if (!authUser || authUser.role !== "agency") {
      return NextResponse.json({ error: "Unauthorized: Agency only" }, { status: 401 });
    }

    const { title, position } = await req.json();

    const { data: column, error } = await supabase
      .from("columns")
      .insert({
        title,
        position,
        location_id: authUser.location_id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(column, { status: 201 });
  } catch (error: any) {
    console.error("Column creation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
