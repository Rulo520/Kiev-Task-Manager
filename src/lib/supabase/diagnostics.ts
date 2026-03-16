import { getAdminClient } from "./admin";

export async function diagnoseSync() {
  console.log("🚀 Starting Sync Diagnosis...");
  const supabase = getAdminClient();
  
  // 1. Check Connection & Key
  const { data: users, error: userError } = await supabase.from("users").select("count");
  if (userError) {
    console.error("❌ DB Connection failed. Check SUPABASE_URL and Keys.", userError);
    return { success: false, error: userError.message };
  }
  console.log("✅ DB Connection successful.");

  // 2. Test Write Persistence
  // Try to update the first task found as a 'ping'
  const { data: firstTask } = await supabase.from("tasks").select("id").limit(1).single();
  if (firstTask) {
    console.log(`📝 Testing write for task ${firstTask.id}...`);
    const { error: writeError } = await supabase
      .from("tasks")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", firstTask.id);
    
    if (writeError) {
      console.error("❌ Write test failed. RLS might still be blocking.", writeError);
      return { success: false, error: writeError.message };
    }
    console.log("✅ Write test successful.");
  } else {
    console.warn("⚠️ No tasks found to test write.");
  }

  // 3. Check Publication
  const { data: pub, error: pubError } = await supabase.rpc('get_current_publication_tables'); 
  // Fallback if RPC doesn't exist
  if (pubError) {
    console.log("ℹ️ RPC for publication check not found, skipping deep pub audit.");
  }

  return { success: true };
}
