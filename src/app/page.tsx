import { KanbanBoard } from "@/components/board/KanbanBoard";
import { createClient } from "@supabase/supabase-js";
import { Column, Task, User } from "@/types/kanban";

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

  if (colError) console.error("Column fetch error:", colError);
  let finalColumns = (columnsData || []) as Column[];

  if (finalColumns.length === 0) {
    const { data: seededColumns } = await supabase
      .from('columns')
      .insert(DEFAULT_COLUMNS)
      .select();
    if (seededColumns) finalColumns = seededColumns as Column[];
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

  if (taskError) console.error("Task fetch error:", taskError);

  // 3. Fetch Users
  const { data: dbUsers } = await supabase.from('users').select('*').eq('role', 'agency');

  return (
    <main className="flex flex-col h-screen w-full relative">
      {/* Debug Overlay (Red/Visible) */}
      {isDebug && (
        <div className="absolute top-2 left-2 z-[9999] bg-red-600 text-white p-6 rounded-xl font-mono text-sm shadow-2xl border-4 border-white max-w-md">
          <p className="font-bold text-xl mb-2 underline tracking-tighter">🚨 DEBUG V2 ACTIVE 🚨</p>
          <div className="space-y-1">
            <p>Columns: {finalColumns.length}</p>
            <p>Tasks stored: {tasksData?.length || 0}</p>
            <p>Supabase Conn: {SUPABASE_URL ? "CONNECTED" : "FAILED"}</p>
            <p>Commit ID: f657134-forced-v2</p>
          </div>
          <hr className="my-3 border-red-400" />
          <p className="text-[10px] opacity-70">RAW TASKS: {JSON.stringify((tasksData || []).map(t => t.title))}</p>
        </div>
      )}

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-200 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          {/* CRITICAL LITMUS TEST: NEW LOGO TEXT */}
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-black text-lg shadow-md animate-pulse">
            V2
          </div>
          <h1 className="text-xl font-black text-gray-900 tracking-tighter">
            GESTOR KIEV <span className="text-red-600">V2.0</span>
          </h1>
          
          {/* HIGHLY VISIBLE DEBUG BUTTON ON THE LEFT */}
          <a 
            href="?debug=true"
            className="ml-4 px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full hover:bg-red-200 transition-colors border border-red-200"
          >
            ACTIVATE DEBUG
          </a>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500 hidden md:block italic">
            Deployment Test Level: High
          </div>
          <div className="h-8 w-8 rounded-full bg-indigo-600"></div>
        </div>
      </header>

      {/* Board Area */}
      <div className="flex-1 overflow-hidden bg-slate-50 relative">
        <KanbanBoard 
          key={finalColumns.length + (tasksData?.length || 0)} 
          initialColumns={finalColumns} 
          initialTasks={(tasksData || []) as unknown as Task[]} 
          role={mockRole}
          initialAgencyUsers={(dbUsers || []) as User[]}
        />
      </div>
    </main>
  );
}
