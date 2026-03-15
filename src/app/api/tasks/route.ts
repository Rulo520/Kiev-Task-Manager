import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser, GHLUser } from "@/lib/auth";

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
    
    // Fallback for development/testing if no valid GHL session is found
    if (!authUser) {
      const { data: firstUser } = await supabase.from("users").select("*").limit(1).single();
      if (!firstUser) {
        return NextResponse.json({ error: "No users found in database for fallback" }, { status: 500 });
      }
      authUser = firstUser as unknown as GHLUser;
    }

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, column_id, priority, due_date, assignees } = body;

    if (!title || !column_id) {
      return NextResponse.json({ error: "Title and Column ID are required" }, { status: 400 });
    }

    // Get current max position in this column
    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("column_id", column_id);

    // Insert Task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title,
        description,
        column_id,
        priority,
        due_date,
        created_by: authUser.id,
        position: count || 0
      })
      .select()
      .single();

    if (taskError) throw taskError;

    // Insert Assignees
    if (assignees && assignees.length > 0) {
      const assigneeRows = assignees.map((userId: string) => ({
        task_id: task.id,
        user_id: userId
      }));
      const { error: assignError } = await supabase.from("task_assignees").insert(assigneeRows);
      if (assignError) console.error("Error saving assignees:", assignError);
    }

    // Return the full task with assignees for the UI
    const { data: fullTask } = await supabase
      .from("tasks")
      .select(`
        *,
        assignees:task_assignees(
          user:users(id, first_name, last_name, profile_pic)
        )
      `)
      .eq("id", task.id)
      .single();

    return NextResponse.json(fullTask || task, { status: 201 });

  } catch (error: unknown) {
    const err = error as Error;
    console.error("Task creation error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = getAdminClient();
    const body = await req.json();
    const { id, column_id, position } = body;

    if (!id) return NextResponse.json({ error: "Task ID required" }, { status: 400 });

    interface UpdateTaskData {
      column_id?: string;
      position?: number;
    }

    const updateData: UpdateTaskData = {};
    if (column_id) updateData.column_id = column_id;
    if (position !== undefined) updateData.position = position;

    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
