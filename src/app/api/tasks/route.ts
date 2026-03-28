import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser, GHLUser } from "@/lib/auth";

import { getAdminClient } from "@/lib/supabase/admin";
import { sendTaskNotification } from "@/lib/notifications";
import { createInAppNotification } from "@/lib/inAppNotifications";


export async function POST(req: Request) {
  try {
    const supabase = getAdminClient();
    let authUser = await getAuthUser(req);
    

    if (!authUser) {
      console.error("[API Tasks] Unauthorized access attempt. No authUser found for request.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[API Tasks] Creating task for user ${authUser.email} (${authUser.role})`);

    const body = await req.json();
    let { title, description, column_id, priority, due_date, assignees, labels, checklists, attachments } = body;

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

      // 3. V22.0 - Auto-Branding logic moved to DB column below
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
        company_name: authUser.role === "agency" ? "Kiev" : authUser.company_name,
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

    // V9.5 - Insert Checklists
    if (checklists && Array.isArray(checklists) && checklists.length > 0) {
      const checklistRows = checklists.map((title: string, index: number) => ({
        task_id: task.id,
        title,
        position: index,
        is_completed: false
      }));
      await supabase.from("task_checklists").insert(checklistRows);
    }

    // V9.5 - Insert Attachments
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const attachmentRows = attachments.map((att: { name: string, url: string }) => ({
        task_id: task.id,
        name: att.name,
        url: att.url,
        type: "link"
      }));
      await supabase.from("task_attachments").insert(attachmentRows);
    }

    // --- NOTIFICATIONS & BROADCAST PREP (V18.2) ---
    const finalPromises: Promise<any>[] = [];
    if (authUser.role === "client") {
      const { data: agencyUsers } = await supabase.from("users").select("id").eq("role", "agency");
      agencyUsers?.forEach(agencyUser => {
        finalPromises.push(createInAppNotification({
          userId: agencyUser.id,
          actorId: authUser.id,
          taskId: task.id,
          type: "TASK_CREATED",
          title: "Nuevo Requerimiento",
          message: `${authUser.first_name} ha creado: ${title}`
        }));
      });
    }

    // --- PARALLEL: FETCH & NOTIFY (V18.2) ---
    const [fullTaskResult, notifResults] = await Promise.all([
      supabase
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
        .single(),

      Promise.all([
        ...finalPromises,
        // Broadcast Sync
        supabase.channel('kanban-global-sync').send({
          type: 'broadcast',
          event: 'TASK_SAVED',
          payload: { taskId: task.id }
        })
      ])
    ]).catch(err => {
      console.error("Parallel POST operations error:", err);
      return [null, null];
    });

    const fullTask = fullTaskResult?.data;

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
    const { id, column_id, position, title, description, priority, due_date, labels, previous_column_id } = body;

    if (!id) return NextResponse.json({ error: "Task ID required" }, { status: 400 });

    // --- PERMISSION CHECK ---
    const { data: existingTask } = await supabase.from("tasks").select("title, description, due_date, priority, created_by, column_id, assignees:task_assignees(user_id)").eq("id", id).single();

    if (!existingTask) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // Fetch creator explicitly to avoid Foreign Key hint crashes
    let creatorData = null;
    if (existingTask.created_by) {
      const { data: creator } = await supabase.from("users").select("email, first_name").eq("id", existingTask.created_by).single();
      creatorData = creator;
    }

    if (authUser.role === "client") {
      // 1. Must be the owner
      if (existingTask.created_by !== authUser.id) {
        return NextResponse.json({ error: "Clients can only edit their own tasks" }, { status: 403 });
      }
      // 2. Must be in the first column
      const { data: firstCol } = await supabase.from("columns").select("id").order("position", { ascending: true }).limit(1).single();
      if (existingTask.column_id !== firstCol?.id) {
        return NextResponse.json({ error: "Clients can only edit tasks in the first column" }, { status: 403 });
      }
      // 3. Clients cannot move tasks
      if (column_id && column_id !== existingTask.column_id) {
        return NextResponse.json({ error: "Clients cannot move tasks" }, { status: 403 });
      }
    }

    const updateData: Partial<Record<string, string | number | null>> = {};
    if (column_id) updateData.column_id = column_id;
    if (position !== undefined) updateData.position = position;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority) updateData.priority = priority;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (previous_column_id !== undefined) updateData.previous_column_id = previous_column_id;

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    }

    // --- NOTIFICATIONS GATHERING (V18.2) ---
    const allNotifPromises: Promise<any>[] = [];

    // --- NOTIFICATIONS: Column Movement ---
    if (column_id && column_id !== existingTask.column_id) {
      try {
        const { data: newCol } = await supabase.from("columns").select("title").eq("id", column_id).single();
        
        // Notify owner
        if (existingTask.created_by && existingTask.created_by !== authUser.id) {
          allNotifPromises.push(createInAppNotification({
            userId: existingTask.created_by,
            actorId: authUser.id,
            taskId: id,
            type: "COLUMN_CHANGE",
            title: "Movimiento de Tarea",
            message: `"${existingTask.title}" se movió a: ${newCol?.title || 'nueva fase'}`
          }));
        }

        // Notify assignees
        existingTask.assignees?.forEach((a: any) => {
          if (a.user_id !== authUser.id) {
            allNotifPromises.push(createInAppNotification({
              userId: a.user_id,
              actorId: authUser.id,
              taskId: id,
              type: "COLUMN_CHANGE",
              title: "Movimiento de Tarea",
              message: `"${existingTask.title}" se movió a: ${newCol?.title || 'nueva fase'}`
            }));
          }
        });

        // Keep legacy email logic
        const { data: existingColRef } = await supabase.from("columns").select("location_id").eq("id", existingTask.column_id).single();
        if (existingColRef?.location_id) {
          const { data: columnsData } = await supabase.from("columns").select("id").eq("location_id", existingColRef.location_id).order("position");
          if (columnsData && columnsData.length > 0) {
            const firstColumnId = columnsData[0].id;
            const lastColumnId = columnsData[columnsData.length - 1].id;

            if (existingTask.column_id === firstColumnId && column_id !== firstColumnId) {
              allNotifPromises.push(sendTaskNotification({
                notificationType: "MOVED_OUT_OF_FIRST_STAGE",
                task: { id, title: title || existingTask.title },
                recipientEmail: creatorData?.email,
                recipientName: creatorData?.first_name || "Cliente"
              }));
            } else if (column_id === lastColumnId && existingTask.column_id !== lastColumnId) {
              allNotifPromises.push(sendTaskNotification({
                notificationType: "REACHED_LAST_STAGE",
                task: { id, title: title || existingTask.title },
                recipientEmail: creatorData?.email,
                recipientName: creatorData?.first_name || "Cliente"
              }));
            }
          }
        }
      } catch (err) {
        console.error("Error gathering movement notification:", err);
      }
    }

    // --- NOTIFICATIONS: Detail Modifications ---
    const metadataChanged = 
      (description !== undefined && description !== existingTask.description) ||
      (due_date !== undefined && due_date !== existingTask.due_date) ||
      (priority !== undefined && priority !== existingTask.priority);

    if (metadataChanged) {
      const recipients = new Set<string>();
      if (existingTask.created_by && existingTask.created_by !== authUser.id) recipients.add(existingTask.created_by);
      existingTask.assignees?.forEach((a: any) => {
        if (a.user_id !== authUser.id) recipients.add(a.user_id);
      });

      recipients.forEach(userId => {
        allNotifPromises.push(createInAppNotification({
          userId,
          actorId: authUser.id,
          taskId: id,
          type: "TASK_UPDATED", 
          title: "Tarea Actualizada",
          message: `${authUser.first_name} actualizó los detalles de "${existingTask.title}"`
        }));
      });
    }

    // --- NOTIFICATIONS: New Assignees ---
    const { assignees } = body;
    if (assignees && Array.isArray(assignees)) {
      // Sync assignees: delete old, insert new
      await supabase.from("task_assignees").delete().eq("task_id", id);
      if (assignees.length > 0) {
        const assigneeRows = assignees.map((userId: string) => ({
          task_id: id,
          user_id: userId
        }));
        await supabase.from("task_assignees").insert(assigneeRows);

        try {
          const previousAssigneeIds = existingTask.assignees?.map((a: any) => a.user_id) || [];
          const newAssigneeIds = assignees.filter((userId: string) => !previousAssigneeIds.includes(userId));
          
          if (newAssigneeIds.length > 0) {
            const { data: newUsers } = await supabase.from("users").select("id, email, first_name").in("id", newAssigneeIds);
            newUsers?.forEach(user => {
              allNotifPromises.push(sendTaskNotification({
                notificationType: "ASSIGNED",
                task: { id, title: title || existingTask.title },
                recipientEmail: user.email,
                recipientName: user.first_name || "Usuario"
              }));

              allNotifPromises.push(createInAppNotification({
                userId: user.id,
                actorId: authUser.id,
                taskId: id,
                type: "ASSIGNED",
                title: "Nueva Asignación",
                message: `${authUser.first_name} te ha asignado la tarea: ${title || existingTask.title}`
              }));
            });
          }
        } catch (err) {
          console.error("Error gathering assignee notification:", err);
        }
      }
    }

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
    // --- PARALLEL: FETCH & NOTIFY (V18.2) ---
    const [fetchResult, notifResults] = await Promise.all([
      supabase
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
        .single(),

      Promise.all([
        ...allNotifPromises,
        supabase.channel('kanban-global-sync').send({
          type: 'broadcast',
          event: 'TASK_SAVED',
          payload: { taskId: id }
        })
      ])
    ]).catch(err => {
      console.error("Parallel PUT operations error:", err);
      return [null, null];
    });

    const fullUpdatedTask = fetchResult?.data;
    if (fetchResult?.error) throw fetchResult.error;

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
