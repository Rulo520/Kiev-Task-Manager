import { KanbanBoard } from "@/components/board/KanbanBoard";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const DEFAULT_COLUMNS = [
  { title: "Para Hacer", position: 1 },
  { title: "En Progreso", position: 2 },
  { title: "Revisión", position: 3 },
  { title: "Completado", position: 4 },
];

export default async function Home({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const mockRole = (searchParams?.role as "agency" | "client") || "agency"; 
  const isDebug = searchParams?.debug === "true";
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Fetch Columns
  const { data: columnsData, error: colError } = await supabase
    .from('columns')
    .select('*')
    .order('position', { ascending: true });

  let finalColumns = columnsData || [];

  // SEED COLUMNS: Only if we are SURE it's empty
  if (finalColumns.length === 0) {
    const { data: seededColumns, error: seedError } = await supabase
      .from('columns')
      .insert(DEFAULT_COLUMNS)
      .select();
    
    if (!seedError && seededColumns) {
      finalColumns = seededColumns;
    } else {
      // LAST RESORT FALLBACK (String IDs - will cause Task Insert errors but UI will show up)
      finalColumns = DEFAULT_COLUMNS.map((c, i) => ({ ...c, id: `fallback-${i}` }));
    }
  }

  // 2. Fetch Tasks
  const { data: tasksData, error: taskError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignees:task_assignees(
        user:users(id, first_name, last_name, profile_pic)
      )
    `)
    .order('position', { ascending: true });

  // 3. Fetch Users
  const { data: dbUsers } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'agency');

  return (
    <main className="flex flex-col h-screen w-full relative">
      {/* Debug Overly (only if ?debug=true) */}
      {isDebug && (
        <div className="absolute top-20 left-6 right-6 z-50 bg-black/90 text-green-400 p-4 rounded-lg font-mono text-xs max-h-[400px] overflow-auto border border-green-500 shadow-2xl">
          <p className="font-bold text-white mb-2">DEBUG MODE ACTIVATED</p>
          <p>Supabase URL: {SUPABASE_URL ? "OK" : "MISSING"}</p>
          <p>Service Role Key: {process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "MISSING (Using Anon)"}</p>
          <p>Columns found: {columnsData?.length || 0}</p>
          <p>Tasks found: {tasksData?.length || 0}</p>
          <p>Col Error: {colError?.message || "None"}</p>
          <p>Task Error: {taskError?.message || "None"}</p>
          <hr className="my-2 opacity-30" />
          <p>RAW COLUMNS: {JSON.stringify(finalColumns.map(c => ({id: c.id, title: c.title})), null, 2)}</p>
          <p className="mt-2">RAW TASKS: {JSON.stringify((tasksData || []).map(t => ({id: t.id, title: t.title, col: t.column_id})), null, 2)}</p>
        </div>
      )}

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
          <button 
            onClick={() => window.location.href = window.location.pathname + "?debug=true"}
            className="text-[10px] text-gray-300 hover:text-gray-500 uppercase tracking-widest"
          >
            Debug
          </button>
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
          key={finalColumns.length + (tasksData?.length || 0)} 
          initialColumns={finalColumns as any} 
          initialTasks={(tasksData || []) as any} 
          role={mockRole}
          initialAgencyUsers={dbUsers || []}
        />
      </div>
    </main>
  );
}
