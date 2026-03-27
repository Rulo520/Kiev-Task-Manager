const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUsers() {
  const { data } = await supabase.from("users").select("id, first_name, email, ghl_user_id, role");
  console.log(JSON.stringify(data, null, 2));
}

checkUsers();
