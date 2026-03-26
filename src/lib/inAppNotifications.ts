import { getAdminClient } from "@/lib/supabase/admin";

export type InAppNotificationType = "ASSIGNED" | "COLUMN_CHANGE" | "COMMENT" | "CHECKLIST" | "TASK_CREATED";

interface InAppNotificationParams {
  userId: string; // Recipient
  actorId?: string; // Who triggered it
  taskId: string;
  type: InAppNotificationType;
  title: string;
  message: string;
}

/**
 * Creates a notification in the database for the user to see in-app.
 */
export async function createInAppNotification({
  userId,
  actorId,
  taskId,
  type,
  title,
  message,
}: InAppNotificationParams) {
  const supabase = getAdminClient();

  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      actor_id: actorId,
      task_id: taskId,
      type: type,
      title: title,
      message: message,
      is_read: false,
    });

    if (error) {
      console.error("[InAppNotification] Error inserting notification:", error);
      return false;
    }

    console.log(`[InAppNotification] Success: ${type} for user ${userId}`);
    return true;
  } catch (err) {
    console.error("[InAppNotification] Critical failure:", err);
    return false;
  }
}
