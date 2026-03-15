import { KanbanBoard } from "@/components/board/KanbanBoard";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Server-side environment check
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const DEFAULT_COLUMNS = [
  { id: "todo", title: "Para Hacer", position: 1 },
  { id: "in_progress", title: "En Progreso", position: 2 },
  { id: "review", title: "Revisión", position: 3 },
  { id: "done", title: "Completado", position: 4 },
];

export default async function Home({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const mockRole = (searchParams?.role as "agency" | "client") || "agency"; 
  
  // Use service role client to ensure we can read/seed everything on load
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Fetch Columns
  console.log(`[${new Date().toISOString()}] Fetching board data...`);
  const { data: columnsData, error: colError } = await supabase
    .from('columns')
    .select('*')
    .order('position', { ascending: true });

  let finalColumns = columnsData || [];

  // SEED COLUMNS: If the table is remote-empty, try to seed it
  if (finalColumns.length === 0) {
    console.log("Seeding default columns into Supabase...");
    const { data: seededColumns, error: seedError } = await supabase
      .from('columns')
      .insert(DEFAULT_COLUMNS.map(({title, position}) => ({ title, position })))
      .select();
    
    if (seedError) {
      console.error("Seeding failed (likely RLS or missing Service Role Key):", seedError);
      // HARD FALLBACK: If seeding fails, we use the default columns anyway 
      // so the user at least SEES something. 
      finalColumns = DEFAULT_COLUMNS;
    } else {
      finalColumns = seededColumns || DEFAULT_COLUMNS;
    }
  }

  // 2. Fetch Tasks (including assignees)
  const { data: tasksData, error: taskError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignees:task_assignees(
        user:users(id, first_name, last_name, profile_pic)
      )
    `)
    .order('position', { ascending: true });

  if (taskError) {
    console.error("Error fetching tasks:", taskError);
  }

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
          key={finalColumns.length} // Force re-render if columns changed
          initialColumns={finalColumns as any} 
          initialTasks={(tasksData || []) as any} 
          role={mockRole}
          initialAgencyUsers={dbUsers || []}
        />
      </div>
    </main>
  );
}
