import { KanbanBoard } from "@/components/board/KanbanBoard";
import { getAuthUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// We mock columns and tasks for the first load to test the UI 
// without needing dummy data perfectly set up in DB immediately.
const DUMMY_COLUMNS = [
  { id: "todo", title: "Para Hacer", position: 1 },
  { id: "in_progress", title: "En Progreso", position: 2 },
  { id: "review", title: "Revisión", position: 3 },
  { id: "done", title: "Completado", position: 4 },
];

const DUMMY_TASKS = [
  {
    id: "task-1",
    title: "Crear automatización de bienvenida",
    description: "Configurar el workflow en GHL para los leads entrantes de Facebook Ads.",
    column_id: "todo",
    position: 1,
    created_by: "user1",
    priority: "high",
    due_date: "2026-03-20T00:00:00Z",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assignees: [
      { user: { id: "a", first_name: "Juan", last_name: "P", role: "agency", profile_pic: null } }
    ]
  },
  {
    id: "task-2",
    title: "Cambiar logo en Landing Page",
    description: "Requerimiento de diseño del cliente.",
    column_id: "in_progress",
    position: 1,
    created_by: "client1",
    priority: "medium",
    due_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assignees: []
  }
];

export default async function Home({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  // Try to authenticate via URL parameter or headers
  // For dev testing outside iframe, we simulate a role
  const mockRole = (searchParams.role as "agency" | "client") || "agency"; 

  // In production, we'd fetch from DB:
  // const supabase = await createClient();
  // const { data: colData } = await supabase.from('columns').select('*');
  // const { data: taskData } = await supabase.from('tasks').select('*, assignees:task_assignees(user:users(*))');

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
          initialColumns={DUMMY_COLUMNS} 
          initialTasks={DUMMY_TASKS as any} 
          role={mockRole}
        />
      </div>
    </main>
  );
}
