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
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Column, Task, User, Role, Label } from "@/types/kanban";
import { Column as BoardColumn } from "./Column";
import { TaskCard } from "./TaskCard";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailModal } from "./TaskDetailModal";
import { createClient } from "@/lib/supabase/client";
import { LayoutGrid, List as ListIcon, Calendar as CalendarIcon, Filter, Search, User as UserIcon, Tag, Plus } from "lucide-react";
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
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const tasksRef = useRef<Task[]>(initialTasks);
  const [agencyUsers] = useState<User[]>(initialAgencyUsers);
  
  const [labels, setLabels] = useState<Label[]>(allLabels);
  
  // Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterLabel, setFilterLabel] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const supabase = useRef(createClient()).current;

  // V13.1 - URL Cleanup (Strip sensitive params after identification)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const paramsToStrip = ["user_id", "userId", "contact_id", "contactId", "location_id", "role"];
      let hasParams = false;
      
      paramsToStrip.forEach(param => {
        if (url.searchParams.has(param)) {
          url.searchParams.delete(param);
          hasParams = true;
        }
      });

      if (hasParams) {
        // Clean URL without reloading page
        window.history.replaceState(null, "", url.pathname + url.search);
      }
    }
  }, []);

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
    // Removed pendingFetches block to ensure the latest update always proceeds
    
    try {

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          creator:users!created_by(*),
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
      // No delay needed if we allow overlapping (Supabase handles order via commit)
    }
  }, [supabase]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key.toLowerCase() === 'f') {
        setShowFilters(prev => !prev);
      }
      if (e.key.toLowerCase() === 'y') {
        setFilterAssignee(currentUser.id);
        setShowFilters(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser.id]);

  useEffect(() => {
    const channel = supabase
      .channel("kanban-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, async (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          const id = (payload.new as { id: string }).id;
          const newPayload = payload.new as any;

          // OPTIMIZATION: Immediate state update with payload (shallows)
          // This makes the card move instantly while the full fetch happens in background
          setTasks((prev) => {
            const index = prev.findIndex(t => t.id === id);
            if (index !== -1) {
                const updated = { ...prev[index], ...newPayload };
                const otherTasks = prev.filter(t => t.id !== id);
                return [updated, ...otherTasks]; // Temporarily un-sorted but in correct list
            }
            return prev;
          });

          const updatedTask = await fetchTaskDetails(id);
          if (updatedTask) {
            setTasks((prev) => {
              const otherTasks = prev.filter(t => t.id !== id);
              // Order by position ASC, then created_at DESC
              return [...otherTasks, updatedTask].sort((a, b) => {
                  if (a.position !== b.position) return a.position - b.position;
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
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
      .on("postgres_changes", { event: "*", schema: "public", table: "columns" }, async (payload: any) => {
        if (payload.eventType === "INSERT") {
          setColumns(prev => [...prev, payload.new].sort((a,b) => a.position - b.position));
        } else if (payload.eventType === "UPDATE") {
          setColumns(prev => prev.map(c => c.id === payload.new.id ? payload.new : c).sort((a,b) => a.position - b.position));
        } else if (payload.eventType === "DELETE") {
          setColumns(prev => prev.filter(c => c.id === payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchTaskDetails]);

  // V13.2 - Open Task from Notification Event
  useEffect(() => {
    const handleOpenTask = async (e: any) => {
      const { taskId } = e.detail;
      
      // OPTIMIZATION: Always fetch fresh data to guarantee accuracy
      setIsDetailOpen(true); // Open immediately (will show loading or existing if found)
      
      const task = tasksRef.current.find(t => t.id === taskId);
      if (task) setDetailTask(task);

      const fetched = await fetchTaskDetails(taskId);
      if (fetched) {
        setDetailTask(fetched);
      }
    };

    window.addEventListener("open-task-detail", handleOpenTask);
    return () => window.removeEventListener("open-task-detail", handleOpenTask);
  }, [fetchTaskDetails]);



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

  const deleteTask = async (taskId: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este requerimiento?")) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { "x-test-user": currentUser.id }
      });

      if (!res.ok) throw new Error("No se pudo eliminar la tarea");
      
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err: any) {
      setSyncError(err.message || "Error al eliminar la tarea");
      setTimeout(() => setSyncError(null), 5000);
    }
  };
  const handleAddColumn = async () => {
    const title = prompt("Nombre de la nueva fase:");
    if (!title) return;
    
    // V9.2 - Visibility Choice
    const isVisibleToClient = confirm("¿Deseas que esta fase sea visible para el CLIENTE?\n\nAceptar = Visible\nCancelar = Solo Agencia");

    try {
      const res = await fetch("/api/columns", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-test-user": currentUser.id
        },
        body: JSON.stringify({ 
          title, 
          position: columns.length + 1,
          is_visible_to_client: isVisibleToClient
        })
      });
      if (res.ok) {
        const newCol = await res.json();
        setColumns(prev => {
          if (prev.some(c => c.id === newCol.id)) return prev;
          return [...prev, newCol].sort((a,b) => a.position - b.position);
        });
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateColumn = async (id: string, title: string, is_visible_to_client?: boolean) => {
    try {
      const res = await fetch(`/api/columns/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-test-user": currentUser.id
        },
        body: JSON.stringify({ title, is_visible_to_client })
      });
      if (res.ok) {
        const updated = await res.json();
        setColumns(prev => prev.map(c => c.id === id ? updated : c));
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteColumn = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta fase? Todas las tareas dentro serán eliminadas.")) return;
    try {
      const res = await fetch(`/api/columns/${id}`, {
        method: "DELETE",
        headers: { "x-test-user": currentUser.id }
      });
      if (res.ok) {
        setColumns(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) { console.error(err); }
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

    if (active.data.current?.type === "Column") {
      if (active.id !== over.id) {
        setColumns((items) => {
          const oldIndex = items.findIndex((i) => i.id === active.id);
          const newIndex = items.findIndex((i) => i.id === over.id);
          const newCols = arrayMove(items, oldIndex, newIndex);
          
          // Persist reorder
          fetch("/api/columns/reorder", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-test-user": currentUser.id },
            body: JSON.stringify({ columnIds: newCols.map(c => c.id) })
          });
          
          return newCols;
        });
      }
      return;
    }

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
      // Ensure local state matches Newest First
      setTasks(prev => prev.map(t => t.id === updated.id ? updated : t).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
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
  const handleCreateTask = async (data: any) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-test-user": currentUser.id
        },
        body: JSON.stringify({ ...data, column_id: activeColumnId })
      });
      if (res.ok) {
        const saved = await res.json();
        setTasks((prev) => {
          const otherTasks = prev.filter(t => t.id !== saved.id);
          return [...otherTasks, saved].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });
        setIsModalOpen(false);
      }
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    if (!columns || columns.length === 0) return;
    const sortedCols = [...columns].sort((a,b) => a.position - b.position);
    const lastColId = sortedCols[sortedCols.length - 1].id;
    const firstColId = sortedCols[0].id;
    const isCurrentlyCompleted = task.column_id === lastColId;
    
    let newColumnId = "";
    let previousColumnId = null;

    if (isCurrentlyCompleted) {
      newColumnId = task.previous_column_id || firstColId;
      previousColumnId = null;
    } else {
      newColumnId = lastColId;
      previousColumnId = task.column_id;
    }

    const updatedTask = { ...task, column_id: newColumnId, previous_column_id: previousColumnId };
    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    if (detailTask && detailTask.id === task.id) setDetailTask(updatedTask);
    
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-test-user": currentUser.id },
        body: JSON.stringify({ id: task.id, column_id: newColumnId, previous_column_id: previousColumnId })
      });
      if (res.ok) {
        const saved = await res.json();
        setTasks(prev => prev.map(t => t.id === saved.id ? saved : t).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        if (detailTask && detailTask.id === saved.id) setDetailTask(saved);
      }
    } catch(err) {
      console.error("Error toggling completion:", err);
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
      if (detailTask && detailTask.id === task.id) setDetailTask(task);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      {/* TOOLBAR */}
      <div className="px-8 pb-6 pt-2 flex flex-col md:flex-row gap-4 items-center justify-between">
        {syncError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-red-600/90 text-white px-6 py-3 rounded-full flex items-center gap-3 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-medium">{syncError}</span>
            <button onClick={() => setSyncError(null)} className="hover:opacity-75 p-1 ml-2">✕</button>
          </div>
        )}

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

        <div className="flex items-center gap-4 bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-gray-100">
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar requerimientos..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-gray-100 rounded-xl py-2 pl-9 pr-6 text-[11px] font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/20 outline-none w-64 transition-all"
            />
          </div>

          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-xl border transition-all ${showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-inner" : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"}`}
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="px-8 pb-6 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 border border-white shadow-xl flex flex-wrap gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Filtrar por Responsable</label>
              <div className="relative">
                <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select 
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="bg-white border border-gray-100 rounded-xl py-2 pl-9 pr-6 text-[11px] font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none min-w-[180px]"
                >
                  <option value="all">Cualquier usuario</option>
                  {(role === 'agency' ? agencyUsers : [currentUser]).map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Filtrar por Etiqueta</label>
              <div className="relative">
                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select 
                  value={filterLabel}
                  onChange={(e) => setFilterLabel(e.target.value)}
                  className="bg-white border border-gray-100 rounded-xl py-2 pl-9 pr-6 text-[11px] font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none min-w-[180px]"
                >
                  <option value="all">Cualquier etiqueta</option>
                  {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
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
                <SortableContext 
                  items={columns.map(c => c.id)} 
                  strategy={horizontalListSortingStrategy}
                  disabled={role === 'client'}
                >
                  {columns.sort((a, b) => a.position - b.position).map((col, index) => (
                    <BoardColumn
                      key={col.id}
                      column={col}
                      tasks={filteredTasks.filter((task) => task.column_id === col.id)}
                      onAddTask={(cid) => { setActiveColumnId(cid); setIsModalOpen(true); }}
                      onTaskClick={openTaskDetail}
                      onDeleteTask={deleteTask}
                      onUpdateColumn={handleUpdateColumn}
                      onDeleteColumn={handleDeleteColumn}
                      role={role}
                      isFirstColumn={index === 0}
                      isLastColumn={index === columns.length - 1}
                      onToggleComplete={handleToggleComplete}
                    />
                  ))}
                </SortableContext>
                
                {role === 'agency' && (
                  <button
                    onClick={handleAddColumn}
                    className="h-fit min-w-[320px] bg-slate-100/50 hover:bg-slate-100 border-2 border-dashed border-slate-200 rounded-[32px] p-6 flex items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 transition-all group shrink-0"
                  >
                    <Plus size={20} className="group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-black uppercase tracking-widest">Añadir Fase</span>
                  </button>
                )}
              </div>
              <DragOverlay>
                {activeTask ? <TaskCard task={activeTask} /> : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {view === "list" && (
          <div className="h-full overflow-y-auto custom-scrollbar pb-10">
            <ListView 
              tasks={filteredTasks} 
              columns={columns} 
              onTaskClick={openTaskDetail}
              onDeleteTask={deleteTask}
            />
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
        onSubmit={handleCreateTask}
        role={role}
        columnId={activeColumnId || ""}
        agencyUsers={agencyUsers}
        availableLabels={labels}
        onLabelCreated={(newLabel) => setLabels(prev => [...prev, newLabel])}
      />

      {detailTask && (
        <TaskDetailModal 
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          task={detailTask}
          role={role}
          currentUser={currentUser}
          isFirstColumn={columns[0]?.id === detailTask.column_id}
          isLastColumn={columns[columns.length - 1]?.id === detailTask.column_id}
          onToggleComplete={handleToggleComplete}
          agencyUsers={agencyUsers}
          availableLabels={labels}
          onLabelCreated={(newLabel) => setLabels(prev => [...prev, newLabel])}
        />
      )}
    </div>
  );
}
