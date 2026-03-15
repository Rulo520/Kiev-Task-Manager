import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const getAdminClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);
    
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: task, error } = await supabase
      .from("tasks")
      .select(`
        *,
        assignees:task_assignees(
          user:users(id, first_name, last_name, profile_pic)
        ),
        labels:task_labels(
          label:labels(*)
        ),
        checklists:task_checklists(*),
        attachments:task_attachments(*),
        comments:task_comments(*)
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    // --- PERMISSION CHECK FOR INTERNAL COMMENTS ---
    if (authUser.role === "client") {
      // Filter out internal comments for clients
      if (task.comments) {
        task.comments = task.comments.filter((c: any) => c.type === "external");
      }
    }

    // Sort relations
    if (task.checklists) {
      task.checklists.sort((a: any, b: any) => a.position - b.position);
    }
    if (task.comments) {
      task.comments.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    return NextResponse.json(task);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
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
    
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check permissions: ONLY agency OR the creator can delete
    const { data: existingTask } = await supabase.from("tasks").select("created_by").eq("id", id).single();
    
    if (!existingTask) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (authUser.role !== "agency" && existingTask.created_by !== authUser.id) {
      return NextResponse.json({ error: "Forbidden: You cannot delete this task" }, { status: 403 });
    }

    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
