import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);

    if (!authUser || authUser.role !== "agency") {
      return NextResponse.json({ error: "Unauthorized: Agency only" }, { status: 401 });
    }

    const { title, is_visible_to_client } = await req.json();

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (is_visible_to_client !== undefined) updateData.is_visible_to_client = is_visible_to_client;

    const { data: column, error } = await supabase
      .from("columns")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(column);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);

    if (!authUser || authUser.role !== "agency") {
      return NextResponse.json({ error: "Unauthorized: Agency only" }, { status: 401 });
    }

    const { error } = await supabase.from("columns").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
