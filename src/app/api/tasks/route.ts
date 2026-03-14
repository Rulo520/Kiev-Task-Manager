import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, column_id, priority, due_date } = body;

    if (!title || !column_id) {
      return NextResponse.json(
        { error: "Title and Column ID are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Determine the new position (append to the bottom of the column)
    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("column_id", column_id);

    const position = count ? count + 1 : 1;

    // Insert new task
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title,
        description,
        column_id,
        created_by: user.id,
        position,
        priority: priority || "medium",
        due_date: due_date || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(task, { status: 201 });

  } catch (error: any) {
    console.error("Create Task API Error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getAuthUser(req);
    if (!user || user.role !== "agency") {
      // For now, only agency can arbitrarily update/move tasks for safety,
      // Or clients can update only their own if we verify it.
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { id, column_id, position, assignees, ...updates } = body;

    const supabase = await createClient();

    // Update Task basic info / drag&drop
    if (column_id || position !== undefined || Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("tasks")
        .update({
             ...(column_id && { column_id }),
             ...(position !== undefined && { position }),
             ...updates,
             updated_at: new Date().toISOString()
         })
        .eq("id", id);
      
      if (error) throw error;
    }

    // Update Assignees (if provided)
    if (assignees && Array.isArray(assignees)) {
      // Simplified: deleting all current assignees and inserting the new ones
      await supabase.from("task_assignees").delete().eq("task_id", id);
      
      const newAssignees = assignees.map((userId: string) => ({
        task_id: id,
        user_id: userId
      }));

      if (newAssignees.length > 0) {
        await supabase.from("task_assignees").insert(newAssignees);
      }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Update Task API Error:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}
