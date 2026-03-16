import { KanbanBoard } from "@/components/board/KanbanBoard";
import { createClient } from "@supabase/supabase-js";
import { Column, Task, User, Role } from "@/types/kanban";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

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
      ),
      labels:task_labels(
        label:labels(*)
      ),
      checklists:task_checklists(*),
      attachments:task_attachments(*),
      comments:task_comments(*)
    `)
    .order('position', { ascending: true });

  if (taskError) console.error("Task fetch error:", taskError);

  // 3. Fetch Labels
  const { data: labelsData } = await supabase.from('labels').select('*');

  // 4. Fetch Users (Agency for assignment)
  const { data: dbUsers } = await supabase.from('users').select('*');

  // 5. Advanced Identity Mapping (V3.4)
  // Priority: 1. userId param, 2. user_id (GHL) param, 3. Find 'Rulo' in DB, 4. First Agency User
  const requestedUserId = (searchParams?.userId as string) || (searchParams?.user_id as string);
  
  let currentUser = (dbUsers || []).find(u => u.id === requestedUserId || u.ghl_user_id === requestedUserId);

  if (!currentUser) {
    // Fallback to Rulo
    currentUser = (dbUsers || []).find(u => u.first_name === "Rulo");
  }

  if (!currentUser) {
    // Last resort: Fallback to any agency user
    currentUser = (dbUsers || []).find(u => u.role === "agency") || dbUsers?.[0];
  }

  // Ensure we have a default object even if DB is empty
  const finalUser = currentUser || {
    id: 'placeholder',
    first_name: "Rulo",
    last_name: "Admin",
    role: "agency",
    profile_pic: null
  } as User;

  const currentRole = (searchParams?.role as Role) || (finalUser.role as Role) || "agency";

  // 6. Client Specific Filtering
  let filteredTasks = (tasksData || []) as unknown as Task[];
  if (currentRole === "client") {
    filteredTasks = filteredTasks.filter(t => t.created_by === finalUser.id);
  }

  return (
    <main className="flex flex-col h-screen w-full relative">
      {/* Debug Overlay */}
      {isDebug && (
        <div className="absolute top-2 left-2 z-[9999] bg-slate-900/90 backdrop-blur-md text-white p-6 rounded-2xl font-mono text-[10px] shadow-2xl border border-white/10 max-w-xs space-y-2">
          <p className="font-black text-indigo-400 text-sm mb-2 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> DEBUG MODULE
          </p>
          <div className="space-y-1 opacity-80">
            <p>Role: <span className="text-white font-bold">{currentRole}</span></p>
            <p>Columns: {finalColumns.length}</p>
            <p>Tasks (Filtered): {filteredTasks.length}</p>
            <p>Total Labels: {labelsData?.length || 0}</p>
          </div>
          <p className="pt-2 text-[8px] opacity-40 break-all">User ID: {finalUser.id}</p>
        </div>
      )}

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200">
            K
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none">
              GHL KIEV <span className="text-indigo-600">PRO</span>
            </h1>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Management Console</span>
          </div>
          
          <div className="ml-8 flex gap-2">
            <a 
              href="?role=agency"
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${currentRole === "agency" ? "bg-indigo-600 text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
            >
              Mode: Agency
            </a>
            <a 
              href="?role=client"
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${currentRole === "client" ? "bg-indigo-600 text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
            >
              Mode: Client
            </a>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end mr-2">
            <div className="text-[11px] font-black text-gray-900 capitalize">{finalUser.first_name} {finalUser.last_name}</div>
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Connected Live ({currentRole})</div>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
            <UserIcon size={20} />
          </div>
        </div>
      </header>

      {/* Board Area */}
      <div className="flex-1 overflow-hidden bg-slate-50 relative">
        <KanbanBoard 
          key={`${currentRole}-${finalUser.id}`} 
          initialColumns={finalColumns} 
          initialTasks={filteredTasks} 
          role={currentRole}
          currentUser={finalUser}
          initialAgencyUsers={(dbUsers || []).filter(u => u.role === 'agency') as User[]}
          allLabels={labelsData || []}
        />
      </div>
    </main>
  );
}

import { User as UserIcon } from "lucide-react";
