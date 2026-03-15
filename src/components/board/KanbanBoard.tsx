"use client";

import { useState, useEffect } from "react";
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

  // Client-side background sync
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
          // API may return 200 with error field if GHL gave 0 users
          if (data.error) {
            setSyncStatus("error");
            setSyncError(data.error);
          } else if (data.users && data.users.length > 0) {
            setAgencyUsers(data.users);
            setSyncStatus("idle");
            setSyncError(null);
          } else {
            setSyncStatus("error");
            setSyncError("GHL devolvió 0 usuarios. Verificá que GHL_COMPANY_ID y GHL_ACCESS_TOKEN (token de Agencia) estén correctamente configurados en Vercel.");
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
      activationConstraint: {
        distance: 5,
      },
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
      
      // Update local state with the real task from DB (includes IDs)
      setTasks([...tasks, savedTask]);
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

    // Dropping a Task over another Task (same or different column)
    if (isActiveTask && isOverTask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);

        if (tasks[activeIndex].column_id !== tasks[overIndex].column_id) {
          // Moving to another column via a task
          const newTasks = [...tasks];
          newTasks[activeIndex].column_id = tasks[overIndex].column_id;
          return newTasks;
        }

        // Same column reordering
        const newTasks = [...tasks];
        const [movedTask] = newTasks.splice(activeIndex, 1);
        newTasks.splice(overIndex, 0, movedTask);
        return newTasks;
      });
    }

    // Dropping a Task over an empty Column
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

    // Find the task that was moved
    const movedTask = tasks.find(t => t.id === activeId);
    if (!movedTask) return;

    try {
      // Save the new state to the database
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: movedTask.id,
          column_id: movedTask.column_id,
          // We could also send position if we implemented reordering fully
        })
      });

      if (!response.ok) throw new Error("Failed to update task position");
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
