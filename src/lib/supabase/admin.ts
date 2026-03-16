import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const getAdminClient = () => {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️ [Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is missing! Administrative operations will likely fail or be blocked by RLS.");
  }
  
  return createClient(
    SUPABASE_URL, 
    SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};
