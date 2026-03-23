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

    const { columnIds } = await req.json();

    if (!columnIds || !Array.isArray(columnIds)) {
      return NextResponse.json({ error: "Invalid columnIds" }, { status: 400 });
    }

    // Update positions sequentially
    const updates = columnIds.map((id, index) => 
      supabase.from("columns").update({ position: index }).eq("id", id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Column reorder error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
