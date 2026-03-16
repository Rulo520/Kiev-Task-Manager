import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth";

import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: task_id } = await params;
    const supabase = getAdminClient();
    const authUser = await getAuthUser(req);
    
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, url, type } = await req.json();

    if (!name || !url) return NextResponse.json({ error: "Name and URL required" }, { status: 400 });

    const { data: attachment, error } = await supabase
      .from("task_attachments")
      .insert({
        task_id,
        name,
        url,
        type: type || "link",
        created_by: authUser.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(attachment, { 
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
