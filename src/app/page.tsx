import { KanbanBoard } from "@/components/board/KanbanBoard";
import { Gatekeeper } from "@/components/auth/Gatekeeper";
import { createClient } from "@supabase/supabase-js";
import { Column, Task, User, Role } from "@/types/kanban";
import { cookies } from "next/headers";
import { ExternalLink } from "lucide-react";

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

export default async function Home({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await searchParamsPromise;
  const isDebug = searchParams?.debug === "true";
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Database Primes (Always same)
  const [{ data: columnsData }, { data: dbUsers }, { data: tasksData }, { data: labelsData }] = await Promise.all([
    supabase.from('columns').select('*').order('position', { ascending: true }),
    supabase.from('users').select('*'),
    supabase.from('tasks').select(`*, creator:users!created_by(*), assignees:task_assignees(user:users(id, first_name, last_name, profile_pic)), labels:task_labels(label:labels(*)), checklists:task_checklists(*), attachments:task_attachments(*), comments:task_comments(*)`).order('position', { ascending: true }),
    supabase.from('labels').select('*')
  ]);

  let finalColumns = (columnsData || []) as Column[];
  if (finalColumns.length === 0) {
    const { data: seeded } = await supabase.from('columns').insert(DEFAULT_COLUMNS).select();
    if (seeded) finalColumns = seeded as Column[];
  }

  // 2. IDENTITY RESOLUTION (V7.0 Braced)
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get("kiev_user_id")?.value;
  
  // Standard GHL identities sent via URL (Custom menu links use these casings)
  const ghlIdentity = (
    (searchParams?.userId as string) || 
    (searchParams?.user_id as string) || 
    (searchParams?.contactId as string) ||
    (searchParams?.contact_id as string)
  );

  // V7.0 Rule: IF we have a GHL Identity in the URL, it MUST override the session cookie (prevents zombie sessions)
  const requestedUserId = ghlIdentity || sessionUserId;
  
  let currentUser = (dbUsers || []).find(u => 
    u.id === requestedUserId || 
    u.ghl_user_id === requestedUserId || 
    u.email === requestedUserId
  );

  // If a valid identity is found from URL, update/refresh the session cookie
  if (currentUser && ghlIdentity) {
    (await cookies()).set("kiev_user_id", currentUser.id, { 
      path: "/", 
      maxAge: 60 * 60, // Reduced to 1 hour for security
      sameSite: "none", // Critical for iFrame access
      secure: true 
    });
  }

  // Gatekeeper: Only authorize if user exists OR debug is active
  const isAuthorized = !!currentUser || isDebug;

  if (!isAuthorized) {
    return (
      <Gatekeeper 
        debug={!!isDebug} 
        isIframe={true} 
      />
    );
  }

  // V7.0 Safety: If isDebug but no user found, we strictly DONT fallback to Rulo unless explicitly told (Admin safety)
  if (!currentUser && isDebug) {
    currentUser = (dbUsers || []).find(u => u.first_name === "Rulo");
  }

  const finalUser = currentUser || {
    id: 'placeholder',
    first_name: "Visitante",
    last_name: "Kiev",
    role: "client",
    profile_pic: null
  } as User;

  const currentRole = (searchParams?.role as Role) || (finalUser.role as Role) || "agency";

  // 3. User Experience Filtering
  let filteredTasks = (tasksData || []) as unknown as Task[];
  if (currentRole === "client") {
    filteredTasks = filteredTasks.filter(t => t.created_by === finalUser.id || t.assignees.some((a: any) => a.user.id === finalUser.id));
  }

  return (
    <main className="flex flex-col h-screen w-full relative">
      {/* Cache Buster V7.1 */}
      <head>
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      
      {isDebug && (
        <div className="absolute top-2 left-2 z-[9999] bg-slate-900/90 backdrop-blur-md text-white p-6 rounded-2xl font-mono text-[10px] shadow-2xl border border-white/10 max-w-xs space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <p className="font-black text-indigo-400 text-sm mb-2 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> DEBUG MODULE
          </p>
          <div className="space-y-1 opacity-80">
            <p>User: <span className="text-white font-bold">{finalUser.first_name}</span></p>
            <p>Identity: {requestedUserId || "None"}</p>
            <p>Role: <span className="text-indigo-400 font-bold">{currentRole}</span></p>
            <p>Tasks: {filteredTasks.length}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200">
            K
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-black text-gray-900 tracking-tight leading-none uppercase">
              Kiev Platform <span className="text-indigo-600">Pro</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] opacity-60">Intelligence Console</span>
              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[8px] font-black border border-slate-200/50">V7.1</span>
            </div>
          </div>
          
          <div className="ml-10 flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
            <a 
              href="?role=agency"
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${currentRole === "agency" ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-gray-400 hover:text-gray-600"}`}
            >
              Agencia
            </a>
            <a 
              href="?role=client"
              className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${currentRole === "client" ? "bg-white text-indigo-600 shadow-sm border border-slate-100" : "text-gray-400 hover:text-gray-600"}`}
            >
              Cliente
            </a>
          </div>

          <a 
            href={`?user_id=${finalUser.id}${isDebug ? "&debug=true" : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl border border-indigo-100 transition-all text-[9px] font-black uppercase tracking-widest group shadow-sm hover:shadow-md"
            title="Sincronizar sesión en una pestaña nueva"
          >
            <ExternalLink size={12} className="group-hover:scale-110 transition-transform" />
            Abrir en Nueva Pestaña
          </a>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <div className="text-[12px] font-black text-gray-900 uppercase tracking-tighter">{finalUser.first_name} {finalUser.last_name}</div>
            <div className="flex items-center gap-1.5">
               <span className="relative flex h-2 w-2">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
               </span>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{currentRole} • Kiev ID-{finalUser.id.slice(0,4)}</span>
            </div>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shadow-inner group">
             {finalUser.profile_pic ? (
               <img src={finalUser.profile_pic} alt="" className="object-cover h-full w-full" />
             ) : (
               <div className="text-indigo-600 font-black text-sm group-hover:scale-110 transition-transform">{finalUser.first_name[0]}{finalUser.last_name[0]}</div>
             )}
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
