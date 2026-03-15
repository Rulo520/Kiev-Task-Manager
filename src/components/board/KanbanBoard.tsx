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
import { Column, Task, User, Role } from "@/types/kanban";
import { Column as BoardColumn } from "./Column";
import { TaskCard } from "./TaskCard";
import { CreateTaskModal } from "./CreateTaskModal";
import { createClient } from "@/lib/supabase/client";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface KanbanBoardProps {
  initialColumns: Column[];
  initialTasks: Task[];
  role: Role;
  initialAgencyUsers?: User[];
}

export function KanbanBoard({ initialColumns, initialTasks, role, initialAgencyUsers = [] }: KanbanBoardProps) {
  // Ensure initial tasks are sorted
  const sortedInitial = [...initialTasks].sort((a, b) => (a.position - b.position) || (a.id > b.id ? 1 : -1));
  
  const [columns] = useState<Column[]>(initialColumns);
  const [tasks, setTasks] = useState<Task[]>(sortedInitial);
  const tasksRef = useRef<Task[]>(sortedInitial);
  
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [agencyUsers, setAgencyUsers] = useState<User[]>(initialAgencyUsers);
  
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const [realtimeConnected, setRealtimeConnected] = useState<"connecting" | "connected" | "error">("connecting");
  const [lastEvent, setLastEvent] = useState<string>("Ninguno");
  const [syncError, setSyncError] = useState<string | null>(null);

  const supabase = useRef(createClient()).current; 

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const fetchTaskDetails = useCallback(async (taskId: string) => {
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        *,
        assignees:task_assignees(
          user:users(id, first_name, last_name, profile_pic)
        )
      `)
      .eq("id", taskId)
      .single();
    
    if (error) {
      console.error("Error fetching task details:", error);
      return null;
    }
    return data as unknown as Task;
  }, [supabase]);

  useEffect(() => {
    console.log("Setting up Realtime subscription...");
    setRealtimeConnected("connecting");

    const channel = supabase
      .channel("public-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        async (payload) => {
          console.log("🔥 REALTIME POSTGRES EVENT:", payload);
          setLastEvent(`DB: ${payload.eventType} @ ${new Date().toLocaleTimeString()}`);
          
          if (payload.eventType === "INSERT") {
            const newTask = await fetchTaskDetails(payload.new.id);
            if (newTask) {
              setTasks((prev) => {
                if (prev.find(t => t.id === newTask.id)) return prev;
                return [...prev, newTask].sort((a, b) => (a.position - b.position) || (a.id > b.id ? 1 : -1));
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedTask = await fetchTaskDetails(payload.new.id);
            if (updatedTask) {
              setTasks((prev) => 
                prev.map(t => t.id === updatedTask.id ? updatedTask : t)
                    .sort((a, b) => (a.position - b.position) || (a.id > b.id ? 1 : -1))
              );
            }
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .on(
        "broadcast",
        { event: "test-broadcast" },
        (payload) => {
          console.log("📡 BROADCAST RECEIVED:", payload);
          setLastEvent(`BROADCAST: ${payload.payload.msg} @ ${new Date().toLocaleTimeString()}`);
        }
      )
      .subscribe((status, err) => {
        console.log("📡 Channel Status Changed:", status, err);
        if (status === "SUBSCRIBED") {
          setRealtimeConnected("connected");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeConnected("error");
          console.error("Realtime connection failed:", status, err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchTaskDetails]);

  const [testResult, setTestResult] = useState<string | null>(null);
  
  const runConnectionTest = async () => {
    setTestResult("Probando...");
    try {
      const { data, error } = await supabase.from('tasks').select('id').limit(1);
      if (error) {
        setTestResult(`❌ Error de RLS/Permisos: ${error.message}`);
        return;
      }
      if (data) {
        setTestResult(`✅ Lectura OK. El problema es la REPLICACIÓN.`);
      }
    } catch (err: unknown) {
      setTestResult(`❌ Error fatal: ${(err as Error).message}`);
    }
  };

  const sendTestBroadcast = async () => {
    setLastEvent("Enviando broadcast...");
    await channelRef.current?.send({
      type: 'broadcast',
      event: 'test-broadcast',
      payload: { msg: 'MAGIC_SYNC_TEST' },
    });
  };

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    channelRef.current = supabase.channel('public-tasks');
  }, [supabase]);

  useEffect(() => {
    if (role === "agency") {
      setSyncStatus("syncing");
      fetch("/api/ghl/users")
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Sync failed");
          return data;
        })
        .then((data) => {
          if (data.users && data.users.length > 0) {
            setAgencyUsers(data.users);
            setSyncStatus("idle");
          }
        })
        .catch((err) => {
          console.error("Background sync error:", err);
          setSyncStatus("error");
          setSyncError(err.message);
        });
    }
  }, [role]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "Task") {
      setActiveTask(event.active.data.current.task);
    }
  }

  function handleAddTaskClick(columnId: string) {
    setActiveColumnId(columnId);
    setIsModalOpen(true);
  }

  async function handleCreateTask(taskData: {
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    due_date: string | null;
    assignees: string[];
  }) {
    try {
      setSyncStatus("syncing");
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...taskData, column_id: activeColumnId })
      });

      if (!response.ok) throw new Error("Failed to save task");
      const savedTask = await response.json();
      
      setTasks((prev) => {
        if (prev.find(t => t.id === savedTask.id)) return prev;
        return [...prev, savedTask].sort((a, b) => (a.position - b.position) || (a.id > b.id ? 1 : -1));
      });
      
      setIsModalOpen(false);
      setActiveColumnId(null);
      setSyncStatus("idle");
    } catch (error: unknown) {
      console.error("Error creating task:", error);
      setSyncError("Error al guardar la tarea.");
      setSyncStatus("error");
    }
  }

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Task";
    const isOverTask = over.data.current?.type === "Task";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveTask) return;

    setTasks((prevTasks) => {
      const activeIndex = prevTasks.findIndex((t) => t.id === activeId);
      if (activeIndex === -1) return prevTasks;

      const newTasks = [...prevTasks];
      const task = { ...newTasks[activeIndex] };

      if (isOverTask) {
        const overIndex = prevTasks.findIndex((t) => t.id === overId);
        if (task.column_id !== prevTasks[overIndex].column_id) {
          task.column_id = prevTasks[overIndex].column_id;
          newTasks[activeIndex] = task;
        } else {
          const [moved] = newTasks.splice(activeIndex, 1);
          newTasks.splice(overIndex, 0, moved);
        }
      } else if (isOverColumn) {
        task.column_id = overId as string;
        newTasks[activeIndex] = task;
      }

      return newTasks;
    });
  };

  async function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const movedTask = tasksRef.current.find(t => t.id === active.id);
    if (!movedTask) return;

    // Calculate new position based on the index in the current tasks array
    const columnTasks = tasks.filter(t => t.column_id === movedTask.column_id);
    const newPosition = columnTasks.findIndex(t => t.id === movedTask.id);

    console.log("💾 Persisting task:", movedTask.title, "Pos:", newPosition, "in", movedTask.column_id);

    try {
      setSyncStatus("syncing");
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: movedTask.id,
          column_id: movedTask.column_id,
          position: newPosition
        })
      });
      if (!res.ok) throw new Error("Persistence failed");
      setSyncStatus("idle");
    } catch (err) {
      console.error("Error saving position:", err);
      setSyncStatus("error");
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="px-8 py-2 bg-white/80 backdrop-blur-sm border-b border-gray-100 flex items-center justify-between text-[11px] font-medium text-gray-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {realtimeConnected === "connected" ? (
              <span className="flex items-center gap-1 text-emerald-600"><Wifi size={12} /> Sync Live</span>
            ) : realtimeConnected === "connecting" ? (
              <span className="flex items-center gap-1 text-amber-500"><Loader2 size={12} className="animate-spin" /> Conectando...</span>
            ) : (
              <span className="flex items-center gap-1 text-red-500"><WifiOff size={12} /> Sync Offline (Enable Replication!)</span>
            )}
          </div>
          <div className="h-3 w-px bg-gray-200" />
          <div className="flex items-center gap-1.5">
            Estado: <span className={syncStatus === "error" ? "text-red-500" : "text-gray-900"}>{syncStatus.toUpperCase()}</span>
          </div>
          <div className="h-3 w-px bg-gray-200" />
          <div className="flex items-center gap-1.5">
            Último Evento: <span className="text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{lastEvent}</span>
          </div>
          <div className="h-3 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <button 
              onClick={runConnectionTest}
              className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors border border-indigo-100 font-bold"
            >
              {testResult || "1. Verificar Lectura"}
            </button>
            <button 
              onClick={sendTestBroadcast}
              className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded hover:bg-emerald-100 transition-colors border border-emerald-100 font-bold"
            >
              2. Probar Broadcast
            </button>
          </div>
        </div>
        
        {realtimeConnected === "error" && (
          <div className="bg-red-50 px-2 py-0.5 rounded text-red-600 font-bold border border-red-100">
            TIP: Run &quot;ALTER PUBLICATION supabase_realtime ADD TABLE tasks;&quot; in SQL Editor
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-x-auto p-4 md:p-8 custom-scrollbar">
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
                tasks={tasks.filter((task) => task.column_id === col.id)}
                onAddTask={handleAddTaskClick}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateTask}
        role={role}
        columnId={activeColumnId || ""}
        agencyUsers={agencyUsers}
        syncError={syncError}
      />
    </div>
  );
}
