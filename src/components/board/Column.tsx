"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, Column as ColumnType } from "@/types/kanban";
import { TaskCard } from "./TaskCard";
import { PlusIcon, MoreHorizontalIcon } from "lucide-react";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onAddTask?: (columnId: string) => void;
  onTaskClick: (task: Task) => void;
}

export function Column({ column, tasks, onAddTask, onTaskClick }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="bg-gray-50/50 rounded-2xl p-4 w-[320px] min-w-[320px] flex flex-col max-h-full border border-gray-200/60 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800 text-sm">
            {column.title}
          </h3>
          <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200/50 transition-colors">
          <MoreHorizontalIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-[150px] space-y-3 p-1 custom-scrollbar">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>
      </div>

      <button
        onClick={() => onAddTask?.(column.id)}
        className="mt-4 flex items-center justify-center w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 bg-transparent hover:bg-gray-200/50 rounded-xl transition-all border border-dashed border-gray-300 hover:border-gray-400"
      >
        <PlusIcon className="w-4 h-4 mr-1.5" />
        New Task
      </button>
    </div>
  );
}
