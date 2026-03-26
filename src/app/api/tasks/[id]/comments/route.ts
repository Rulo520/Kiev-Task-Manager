import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth";

import { getAdminClient } from "@/lib/supabase/admin";
import { createInAppNotification } from "@/lib/inAppNotifications";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: task_id } = await params;
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);
    
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { content, type } = await req.json();

    if (!content) return NextResponse.json({ error: "Content required" }, { status: 400 });

    // --- PERMISSION CHECK ---
    if (authUser.role === "client" && type === "internal") {
      return NextResponse.json({ error: "Clients cannot post internal comments" }, { status: 403 });
    }

    const { data: comment, error } = await supabase
      .from("task_comments")
      .insert({
        task_id,
        user_id: authUser.id,
        content,
        type: type || "external"
      })
      .select(`
        *,
        user:users(id, first_name, last_name, profile_pic)
      `)
      .single();

    if (error) throw error;

    // --- IN-APP NOTIFICATIONS: New Comment ---
    try {
      // 1. Fetch task owner and assignees
      const { data: task } = await supabase
        .from("tasks")
        .select("title, created_by, assignees:task_assignees(user_id)")
        .eq("id", task_id)
        .single();

      if (task) {
        const recipients = new Set<string>();
        if (task.created_by && task.created_by !== authUser.id) recipients.add(task.created_by);
        task.assignees?.forEach((a: any) => {
          if (a.user_id !== authUser.id) recipients.add(a.user_id);
        });

        // 1. Fetch task owner, assignees, and their roles
        const { data: recipientsData, error: rolesError } = await supabase
          .from("users")
          .select("id, role")
          .in("id", Array.from(recipients));

        if (!rolesError && recipientsData) {
          recipientsData.forEach(recipient => {
            // Skip clients if it's an internal comment
            if (type === "internal" && recipient.role === "client") return;

            createInAppNotification({
              userId: recipient.id,
              actorId: authUser.id,
              taskId: task_id,
              type: "COMMENT",
              title: type === "internal" ? "Nuevo Mensaje Privado" : "Nuevo Comentario",
              message: `${authUser.first_name} comentó: ${content.substring(0, 30)}${content.length > 30 ? "..." : ""}`
            });
          });
        }
      }
    } catch (err) {
      console.error("Error triggering comment notification:", err);
    }


    return NextResponse.json(comment, { 
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
