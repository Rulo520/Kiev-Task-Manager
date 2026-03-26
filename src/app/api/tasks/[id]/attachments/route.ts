import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth";

import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: task_id } = await params;
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);
    
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, url, type } = body;

    if (!name || !url) return NextResponse.json({ error: "Name and URL required" }, { status: 400 });

    const { data: task } = await supabase.from("tasks").select("created_by, column_id").eq("id", task_id).single();
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (authUser.role !== "agency") {

      // 1. Must be the owner
      if (task.created_by !== authUser.id) {
         return NextResponse.json({ error: "Forbidden: Not the task owner" }, { status: 403 });
      }
      // 2. Must be in the first column
      const { data: firstCol } = await supabase.from("columns").select("id").order("position", { ascending: true }).limit(1).single();
      if (task.column_id !== firstCol?.id) {
         return NextResponse.json({ error: "Forbidden: Tasks can only be edited in the first column" }, { status: 403 });
      }
    }

    const { data: attachment, error } = await supabase
      .from("task_attachments")
      .insert({
        task_id,
        name,
        url,
        type: type || "link",
        created_by: authUser.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(attachment, { 
      status: 201, 
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
