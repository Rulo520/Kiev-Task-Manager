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

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        async (payload) => {
          console.log("🔥 DB CHANGE DETECTED:", payload);
          
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const id = (payload.new as { id: string }).id;
            const updatedTask = await fetchTaskDetails(id);
            if (updatedTask) {
              setTasks((prev) => {
                const filtered = prev.filter(t => t.id !== id);
                return [...filtered, updatedTask].sort((a, b) => (a.position - b.position) || (a.id > b.id ? 1 : -1));
              });
            }
          } else if (payload.eventType === "DELETE") {
            setTasks((prev) => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchTaskDetails]);

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
