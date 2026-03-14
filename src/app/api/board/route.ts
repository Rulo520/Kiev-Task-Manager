import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req);
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // 1. Fetch Columns (Ordered by position)
    const { data: columns, error: colError } = await supabase
      .from("columns")
      .select("*")
      .order("position", { ascending: true });

    if (colError) throw colError;

    // 2. Fetch Tasks Based on Role
    let taskQuery = supabase
      .from("tasks")
      .select(`
        *,
        assignees:task_assignees(
          user:users(id, first_name, last_name, profile_pic)
        )
      `)
      .order("position", { ascending: true });

    // Client Role Restriction: 
    // Clients should only see tasks they created.
    if (user.role === "client") {
      taskQuery = taskQuery.eq("created_by", user.id);
    }

    const { data: tasks, error: taskError } = await taskQuery;

    if (taskError) throw taskError;

    // Format the response for the Kanban frontend
    return NextResponse.json({
      columns: columns || [],
      tasks: tasks || [],
    });

  } catch (error: any) {
    console.error("Board API Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch board data" },
      { status: 500 }
    );
  }
}
