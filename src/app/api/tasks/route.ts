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
    
    // Fallback for development/testing
    if (!authUser) {
      const { data: firstUser } = await supabase.from("users").select("*").limit(1).single();
      if (!firstUser) {
        return NextResponse.json({ error: "No users found" }, { status: 500 });
      }
      authUser = firstUser as unknown as GHLUser;
    }

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, column_id, priority, due_date, assignees, labels } = body;

    // --- PERMISSION CHECK ---
    if (authUser.role === "client") {
      // 1. Must use the first column
      const { data: firstCol } = await supabase.from("columns").select("id").order("position", { ascending: true }).limit(1).single();
      if (firstCol && column_id !== firstCol.id) {
        return NextResponse.json({ error: "Clients can only create tasks in the first column" }, { status: 403 });
      }
      // 2. Clients cannot assign other users (assignees must be empty or just themselves)
      if (assignees && assignees.length > 0) {
        return NextResponse.json({ error: "Clients cannot assign users" }, { status: 403 });
      }
    }

    // Get current max position
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
        location_id: authUser.location_id,
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
      await supabase.from("task_assignees").insert(assigneeRows);
    }

    // Insert Labels
    if (labels && labels.length > 0) {
      const labelRows = labels.map((labelId: string) => ({
        task_id: task.id,
        label_id: labelId
      }));
      await supabase.from("task_labels").insert(labelRows);
    }

    // Return the full task with relationships
    const { data: fullTask } = await supabase
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
      .eq("id", task.id)
      .single();

    return NextResponse.json(fullTask || task, { 
      status: 201,
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });

  } catch (error: unknown) {
    console.error("Task creation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);
    
    // We should always have a user for PUT
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, column_id, position, title, description, priority, due_date, labels } = body;

    if (!id) return NextResponse.json({ error: "Task ID required" }, { status: 400 });

    // --- PERMISSION CHECK ---
    const { data: existingTask } = await supabase.from("tasks").select("created_by, column_id").eq("id", id).single();
    if (!existingTask) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (authUser.role === "client") {
      // 1. Must be the owner
      if (existingTask.created_by !== authUser.id) {
        return NextResponse.json({ error: "Clients can only edit their own tasks" }, { status: 403 });
      }
      // 2. Clients cannot move tasks out of the first column
      if (column_id && column_id !== existingTask.column_id) {
        return NextResponse.json({ error: "Clients cannot move tasks" }, { status: 403 });
      }
    }

    const updateData: Partial<Record<string, string | number | null>> = {};
    if (column_id) updateData.column_id = column_id;
    if (position !== undefined) updateData.position = position;
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority) updateData.priority = priority;
    if (due_date !== undefined) updateData.due_date = due_date;

    const { error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    // Handle Label Updates
    if (labels) {
      await supabase.from("task_labels").delete().eq("task_id", id);
      if (labels.length > 0) {
        const labelRows = labels.map((labelId: string) => ({
          task_id: id,
          label_id: labelId
        }));
        await supabase.from("task_labels").insert(labelRows);
      }
    }

    // Now Fetch the FULL transformed task to return
    const { data: fullUpdatedTask, error: fetchError } = await supabase
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

    if (fetchError) throw fetchError;

    return NextResponse.json(fullUpdatedTask, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
