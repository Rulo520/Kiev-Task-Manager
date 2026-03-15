import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper to get a client that bypasses RLS if needed
const getAdminClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function POST(req: Request) {
  try {
    const supabase = getAdminClient();
    let authUser = await getAuthUser(req);
    
    // Fallback for development: if no auth user, pick the first user from DB
    if (!authUser) {
      const { data: firstUser } = await supabase.from("users").select("id").limit(1).single();
      if (firstUser) {
        authUser = { id: firstUser.id } as any;
      } else {
        return NextResponse.json({ error: "No users found in database to assign as creator" }, { status: 500 });
      }
    }

    const body = await req.json();
    const { title, description, column_id, priority, due_date, assignees } = body;

    if (!title || !column_id) {
      return NextResponse.json({ error: "Title and Column ID are required" }, { status: 400 });
    }

    // Determine position
    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("column_id", column_id);

    const position = count ? count + 1 : 1;

    // 1. Create Task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title,
        description,
        column_id,
        created_by: authUser?.id,
        position,
        priority: priority || "medium",
        due_date: due_date || null,
      })
      .select()
      .single();

    if (taskError) throw taskError;

    // 2. Handle Assignees
    if (assignees && Array.isArray(assignees) && assignees.length > 0) {
      const assigneeRows = assignees.map((userId: string) => ({
        task_id: task.id,
        user_id: userId
      }));
      const { error: assigneeError } = await supabase.from("task_assignees").insert(assigneeRows);
      if (assigneeError) console.error("Error inserting assignees:", assigneeError);
    }

    return NextResponse.json(task, { status: 201 });

  } catch (error: any) {
    console.error("Create Task API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to create task" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = getAdminClient();
    const body = await req.json();
    const { id, column_id, position, assignees, ...updates } = body;

    if (!id) return NextResponse.json({ error: "Task ID required" }, { status: 400 });

    // Update Task
    const { error: taskError } = await supabase
      .from("tasks")
      .update({
        ...(column_id && { column_id }),
        ...(position !== undefined && { position }),
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    
    if (taskError) throw taskError;

    // Update Assignees
    if (assignees && Array.isArray(assignees)) {
      await supabase.from("task_assignees").delete().eq("task_id", id);
      if (assignees.length > 0) {
        const assigneeRows = assignees.map((userId: string) => ({
          task_id: id,
          user_id: userId
        }));
        await supabase.from("task_assignees").insert(assigneeRows);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Update Task API Error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
