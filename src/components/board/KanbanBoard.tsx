"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [columns] = useState<Column[]>(initialColumns);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [agencyUsers, setAgencyUsers] = useState<User[]>(initialAgencyUsers);
  const [, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);

  const supabase = createClient();

  // Helper to fetch full task details (including assignees)
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
    
    if (error) console.error("Error fetching task details:", error);
    return data as unknown as Task;
  }, [supabase]);

  // Real-time listener for tasks
  useEffect(() => {
    const channel = supabase
      .channel("tasks-db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        async (payload) => {
          console.log("Realtime Change:", payload);
          
          if (payload.eventType === "INSERT") {
            const newTask = await fetchTaskDetails(payload.new.id);
            if (newTask) {
              setTasks((prev) => {
                if (prev.find(t => t.id === newTask.id)) return prev;
                return [...prev, newTask];
              });
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedTask = await fetchTaskDetails(payload.new.id);
            if (updatedTask) {
              setTasks((prev) => 
                prev.map(t => t.id === updatedTask.id ? updatedTask : t)
              );
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

  // Client-side background sync for GHL users
  useEffect(() => {
    if (role === "agency") {
      setSyncStatus("syncing");
      fetch("/api/ghl/users")
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Sync failed");
          }
          return data;
        })
        .then((data) => {
          if (data.error) {
            setSyncStatus("error");
            setSyncError(data.error);
          } else if (data.users && data.users.length > 0) {
            setAgencyUsers(data.users);
            setSyncStatus("idle");
            setSyncError(null);
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
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "Task") {
      setActiveTask(event.active.data.current.task);
      return;
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
        body: JSON.stringify({
          ...taskData,
          column_id: activeColumnId
        })
      });

      if (!response.ok) throw new Error("Failed to save task");
      
      const savedTask = await response.json();
      
      // Update local state (Realtime handles this too, but we do it for immediate feedback)
      setTasks((prev) => {
        if (prev.find(t => t.id === savedTask.id)) return prev;
        return [...prev, savedTask];
      });
      
      setIsModalOpen(false);
      setActiveColumnId(null);
      setSyncStatus("idle");
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error creating task:", err);
      setSyncError("Error al guardar la tarea en la base de datos.");
      setSyncStatus("error");
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Task";
    const isOverTask = over.data.current?.type === "Task";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveTask) return;

    if (isActiveTask && isOverTask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        if (tasks[activeIndex].column_id !== tasks[overIndex].column_id) {
          const newTasks = [...tasks];
          newTasks[activeIndex].column_id = tasks[overIndex].column_id;
          return newTasks;
        }

        const newTasks = [...tasks];
        const [movedTask] = newTasks.splice(activeIndex, 1);
        newTasks.splice(overIndex, 0, movedTask);
        return newTasks;
      });
    }

    if (isActiveTask && isOverColumn) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const newTasks = [...tasks];
        newTasks[activeIndex].column_id = overId as string;
        return newTasks;
      });
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    
    // Crucial: access the LATEST state by using a temporary reference 
    // or relying on the state update from onDragOver having completed.
    // In onDragEnd, 'tasks' reflects the state AFTER onDragOver modifications.
    const movedTask = tasks.find(t => t.id === activeId);
    if (!movedTask) return;

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: movedTask.id,
          column_id: movedTask.column_id,
          // Position could be added here if we track numerical order
        })
      });
    } catch (err) {
      console.error("Error saving task position:", err);
    }
  }

  return (
    <>
      <div className="flex h-full w-full overflow-x-auto p-4 md:p-8 custom-scrollbar">
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
    </>
  );
}
