import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth";

import { getAdminClient } from "@/lib/supabase/admin";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);
    
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { title, is_completed, position } = body;

    // Permissions: Clients can toggle completion ONLY on their own tasks (checked via join)
    // For simplicity, we check if the task allows client toggle or if user is agency
    const { data: item } = await supabase
      .from("task_checklists")
      .select("task_id, tasks(created_by)")
      .eq("id", itemId)
      .single();

    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const taskData: any = item.tasks;
    if (authUser.role !== "agency" && taskData.created_by !== authUser.id) {
       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (is_completed !== undefined) updateData.is_completed = is_completed;
    if (position !== undefined) updateData.position = position;

    const { data, error } = await supabase
      .from("task_checklists")
      .update(updateData)
      .eq("id", itemId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);
    
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: item } = await supabase
      .from("task_checklists")
      .select("task_id, tasks(created_by)")
      .eq("id", itemId)
      .single();

    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const taskData: any = item.tasks;
    if (authUser.role !== "agency" && taskData.created_by !== authUser.id) {
       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase.from("task_checklists").delete().eq("id", itemId);
    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
