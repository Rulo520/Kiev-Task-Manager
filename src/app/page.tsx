import { KanbanBoard } from "@/components/board/KanbanBoard";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function Home({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const mockRole = (searchParams?.role as "agency" | "client") || "agency"; 
  
  // Use service role client to ensure we can read/seed everything on load
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Fetch Columns
  let { data: columns } = await supabase
    .from('columns')
    .select('*')
    .order('position', { ascending: true });

  // SEED COLUMNS: If the table is empty, seed it automatically
  if (!columns || columns.length === 0) {
    const defaultColumns = [
      { title: "Para Hacer", position: 1 },
      { title: "En Progreso", position: 2 },
      { title: "Revisión", position: 3 },
      { title: "Completado", position: 4 },
    ];
    
    // Using upsert/insert with selection to get back the generated UUIDs
    const { data: seededColumns } = await supabase
      .from('columns')
      .insert(defaultColumns)
      .select();
    
    columns = seededColumns || [];
  }

  // 2. Fetch Tasks (including assignees)
  let { data: tasks } = await supabase
    .from('tasks')
    .select(`
      *,
      assignees:task_assignees(
        user:users(id, first_name, last_name, profile_pic)
      )
    `)
    .order('position', { ascending: true });

  // 3. Fetch Agency Users (for assignment list)
  const { data: dbUsers } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'agency');

  return (
    <main className="flex flex-col h-screen w-full">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            K
          </div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">
            Gestor de Tareas <span className="text-gray-400 font-normal ml-1">| {mockRole === "agency" ? "Agencia" : "Cliente"}</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500 hidden md:block">
            Sincronizado con Go High Level
          </div>
          <div className="h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200"></div>
        </div>
      </header>

      {/* Board Area */}
      <div className="flex-1 overflow-hidden bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-slate-50 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-white/50 to-blue-50/40 pointer-events-none" />
        <KanbanBoard 
          initialColumns={(columns || []) as any} 
          initialTasks={(tasks || []) as any} 
          role={mockRole}
          initialAgencyUsers={dbUsers || []}
        />
      </div>
    </main>
  );
}
