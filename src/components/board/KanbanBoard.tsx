"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Column, Task, User, Role, Label } from "@/types/kanban";
import { Column as BoardColumn } from "./Column";
import { TaskCard } from "./TaskCard";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailModal } from "./TaskDetailModal";
import { createClient } from "@/lib/supabase/client";
import { LayoutGrid, List as ListIcon, Calendar as CalendarIcon, Filter, Search, User as UserIcon, Tag } from "lucide-react";
import { ListView } from "./ListView";
import { CalendarView } from "./CalendarView";

interface KanbanBoardProps {
  initialColumns: Column[];
  initialTasks: Task[];
  role: Role;
  currentUser: User;
  initialAgencyUsers?: User[];
  allLabels?: Label[];
}

export function KanbanBoard({ initialColumns, initialTasks, role, currentUser, initialAgencyUsers = [], allLabels = [] }: KanbanBoardProps) {
  // --- STATE ---
  const [view, setView] = useState<"kanban" | "list" | "calendar">("kanban");
  const [columns] = useState<Column[]>(initialColumns);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const tasksRef = useRef<Task[]>(initialTasks);
  const [agencyUsers] = useState<User[]>(initialAgencyUsers);
  
  // Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterLabel, setFilterLabel] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const supabase = useRef(createClient()).current;

  // Sync tasksRef for dnd callbacks
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // --- DERIVED DATA (FILTERING) ---
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAssignee = filterAssignee === "all" || task.assignees.some(a => a.user.id === filterAssignee);
    const matchesLabel = filterLabel === "all" || task.labels.some((l: { label: { id: string } }) => l.label.id === filterLabel);
    
    return matchesSearch && matchesAssignee && matchesLabel;
  });

  // --- REALTIME ---
  const pendingFetches = useRef<Set<string>>(new Set());

  const fetchTaskDetails = useCallback(async (taskId: string) => {
    if (pendingFetches.current.has(taskId)) return null;
    pendingFetches.current.add(taskId);
    
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          assignees:task_assignees(user:users(id, first_name, last_name, profile_pic)),
          labels:task_labels(label:labels(*)),
          checklists:task_checklists(*),
          attachments:task_attachments(*),
          comments:task_comments(*)
        `)
        .eq("id", taskId)
        .single();
      
      if (error) return null;
      return data as unknown as Task;
    } finally {
      // Small delay to prevent rapid-fire redundant fetches
      setTimeout(() => pendingFetches.current.delete(taskId), 200);
    }
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("kanban-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, async (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const id = (payload.new as { id: string }).id;
          const updatedTask = await fetchTaskDetails(id);
          if (updatedTask) {
            setTasks((prev) => {
              const otherTasks = prev.filter(t => t.id !== id);
              return [...otherTasks, updatedTask].sort((a, b) => (a.position - b.position) || (a.id > b.id ? 1 : -1));
            });
          }
        } else if (payload.eventType === "DELETE") {
          setTasks((prev) => prev.filter(t => t.id !== payload.old.id));
        }
      })
      // Grouping all child table events to a single sync logic
      .on("postgres_changes", { event: "*", schema: "public", table: "task_checklists" }, async (payload: any) => {
        const taskId = payload.new ? payload.new.task_id : payload.old.task_id;
        if (taskId) {
          const updatedTask = await fetchTaskDetails(taskId);
          if (updatedTask) setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_comments" }, async (payload: any) => {
        const taskId = payload.new ? payload.new.task_id : payload.old.task_id;
        if (taskId) {
          const updatedTask = await fetchTaskDetails(taskId);
          if (updatedTask) setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_attachments" }, async (payload: any) => {
        const taskId = payload.new ? payload.new.task_id : payload.old.task_id;
        if (taskId) {
          const updatedTask = await fetchTaskDetails(taskId);
          if (updatedTask) setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_labels" }, async (payload: any) => {
        const taskId = payload.new ? payload.new.task_id : payload.old.task_id;
        if (taskId) {
          const updatedTask = await fetchTaskDetails(taskId);
          if (updatedTask) setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, async (payload: any) => {
        const taskId = payload.new ? payload.new.task_id : payload.old.task_id;
        if (taskId) {
          const updatedTask = await fetchTaskDetails(taskId);
          if (updatedTask) setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchTaskDetails]);

  // --- DND HANDLERS ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isSyncing = useRef(false);
  
  // Detail Modal State
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const openTaskDetail = (task: Task) => {
    setDetailTask(task);
    setIsDetailOpen(true);
  };

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "Task") {
      setActiveTask(event.active.data.current.task);
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const movedTask = tasksRef.current.find(t => t.id === active.id);
    if (!movedTask) return;

    // --- PERMISSION CHECK FOR CLIENT ---
    if (role === "client") {
       // Clients cannot move tasks (API will also reject but we prevent UI movement)
       // Force state reset if they tried (tasks state is already updated in onDragOver)
       // This is a bit tricky, but for now we rely on the fact that we don't allow them to 
       // drag out of the first column in the UI logic or reject in API.
    }

    const columnTasks = tasks.filter(t => t.column_id === movedTask.column_id);
    const newPosition = columnTasks.findIndex(t => t.id === movedTask.id);

    const prevState = [...tasks];
    
    // Optimistic Update is already done by onDragOver/onDragEnd logic, 
    // but here we handle the persistence failure
    try {
      setSyncError(null);
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-test-user": currentUser.id
        },
        cache: "no-store",
        body: JSON.stringify({ id: movedTask.id, column_id: movedTask.column_id, position: newPosition })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Error al guardar en el servidor");
      }
      
      const updated = await res.json();
      // Ensure local state matches exactly what API returned
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t).sort((a,b) => a.position - b.position));
    } catch (err: any) {
      console.error("Error saving position:", err);
      // Revert state if persistence fails
      setTasks(prevState);
      setSyncError(err.message || "No se pudo guardar el cambio. Reintentando...");
      
      // Auto-hide error after 5s
      setTimeout(() => setSyncError(null), 5000);
    } finally {
      isSyncing.current = false;
    }
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Task";
    if (!isActiveTask) return;

    // --- CLIENT ROLE RESTRICTION ---
    // If client, they can only reorder in the FIRST column
    if (role === "client") {
      const firstCol = columns.sort((a, b) => a.position - b.position)[0];
      const isOverOtherCol = over.data.current?.type === "Column" && over.id !== firstCol.id;
      const isOverTaskInOtherCol = over.data.current?.type === "Task" && over.data.current.task.column_id !== firstCol.id;
      
      if (isOverOtherCol || isOverTaskInOtherCol) return; // Prevent drag-over
    }

    setTasks((prevTasks) => {
      const activeIndex = prevTasks.findIndex((t) => t.id === activeId);
      if (activeIndex === -1) return prevTasks;

      const newTasks = [...prevTasks];
      const task = { ...newTasks[activeIndex] };

      if (over.data.current?.type === "Task") {
        const overIndex = prevTasks.findIndex((t) => t.id === overId);
        if (task.column_id !== prevTasks[overIndex].column_id) {
          task.column_id = prevTasks[overIndex].column_id;
          newTasks[activeIndex] = task;
        } else {
          const [moved] = newTasks.splice(activeIndex, 1);
          newTasks.splice(overIndex, 0, moved);
        }
      } else if (over.data.current?.type === "Column") {
        task.column_id = overId as string;
        newTasks[activeIndex] = task;
      }

      return newTasks;
    });
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* TOOLBAR */}
      <div className="px-8 pb-6 pt-2 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Sync Error Toast */}
      {syncError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-red-600/90 text-white px-6 py-3 rounded-full flex items-center gap-3 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="font-medium">{syncError}</span>
          <button onClick={() => setSyncError(null)} className="hover:opacity-75 p-1 ml-2">✕</button>
        </div>
      )}

      {/* Kanban Board Container */}
        {/* View Switcher */}
        <div className="flex bg-white/80 backdrop-blur-sm border border-gray-100 p-1.5 rounded-2xl shadow-sm self-start">
          <button 
            onClick={() => setView("kanban")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === "kanban" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"}`}
          >
            <LayoutGrid size={16} /> Kanban
          </button>
          <button 
            onClick={() => setView("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === "list" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"}`}
          >
            <ListIcon size={16} /> Lista
          </button>
          <button 
            onClick={() => setView("calendar")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${view === "calendar" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400 hover:text-gray-600"}`}
          >
            <CalendarIcon size={16} /> Calendario
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none md:w-64 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Buscar requerimientos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/80 border border-transparent border-gray-100 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-bold transition-all placeholder:text-gray-300"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-2xl border transition-all ${showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-gray-100 text-gray-400 hover:text-gray-600 shadow-sm"}`}
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="px-8 mb-6 animate-in slide-in-from-top-2 duration-300">
          <div className="bg-white/80 backdrop-blur-md border border-gray-100/50 p-6 rounded-[2rem] shadow-xl shadow-indigo-500/5 flex flex-wrap gap-8">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Asignado a</label>
              <div className="relative flex items-center">
                <UserIcon size={14} className="absolute left-3 text-gray-300" />
                <select 
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="bg-white border border-gray-100 rounded-xl py-2 pl-9 pr-6 text-[11px] font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none"
                >
                  <option value="all">Todos los miembros</option>
                  {agencyUsers.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Etiqueta</label>
              <div className="relative flex items-center">
                <Tag size={14} className="absolute left-3 text-gray-300" />
                <select 
                  value={filterLabel}
                  onChange={(e) => setFilterLabel(e.target.value)}
                  className="bg-white border border-gray-100 rounded-xl py-2 pl-9 pr-6 text-[11px] font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none"
                >
                  <option value="all">Cualquier etiqueta</option>
                  {allLabels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1 flex items-end justify-end">
              <button 
                onClick={() => { setFilterAssignee("all"); setFilterLabel("all"); setSearchQuery(""); }}
                className="text-xs font-black text-indigo-600 hover:text-indigo-700 underline underline-offset-4 decoration-2 decoration-indigo-200"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW RENDERER */}
      <div className="flex-1 overflow-hidden">
        {view === "kanban" && (
          <div className="flex-1 flex overflow-x-auto p-4 md:p-8 pt-0 custom-scrollbar h-full">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            >
              <div className="flex gap-6 h-full items-start">
                {columns.map((col) => (
                  <BoardColumn
                    key={col.id}
                    column={col}
                    tasks={filteredTasks.filter((task) => task.column_id === col.id)}
                    onAddTask={(cid) => { setActiveColumnId(cid); setIsModalOpen(true); }}
                    onTaskClick={openTaskDetail}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeTask ? <TaskCard task={activeTask} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {view === "list" && (
          <div className="h-full overflow-y-auto custom-scrollbar pb-10">
            <ListView tasks={filteredTasks} columns={columns} />
          </div>
        )}

        {view === "calendar" && (
          <div className="h-full overflow-y-auto custom-scrollbar pb-10">
            <CalendarView tasks={filteredTasks} />
          </div>
        )}
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={async (data) => {
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-test-user": currentUser.id
            },
            cache: "no-store",
            body: JSON.stringify({ ...data, column_id: activeColumnId })
          });
          if (res.ok) {
            const saved = await res.json();
            setTasks(prev => [...prev.filter(t => t.id !== saved.id), saved].sort((a, b) => a.position - b.position));
            setIsModalOpen(false);
          }
        }}
        role={role}
        columnId={activeColumnId || ""}
        agencyUsers={agencyUsers}
        syncError={null}
        allLabels={allLabels}
      />

      {detailTask && (
        <TaskDetailModal 
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          task={detailTask}
          role={role}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
