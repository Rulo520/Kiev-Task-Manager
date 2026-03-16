import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth";

import { getAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { attachmentId } = await params;
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);
    
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: attachment } = await supabase
      .from("task_attachments")
      .select("created_by, task_id")
      .eq("id", attachmentId)
      .single();

    if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

    // Permissions: Agency or File Owner
    if (authUser.role !== "agency" && attachment.created_by !== authUser.id) {
       return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase.from("task_attachments").delete().eq("id", attachmentId);
    if (error) throw error;

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
