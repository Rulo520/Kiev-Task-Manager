import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const getAdminClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

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

    return NextResponse.json(comment, { status: 201 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
