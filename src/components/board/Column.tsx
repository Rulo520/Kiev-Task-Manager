"use client";

import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, Column as ColumnType, Role } from "@/types/kanban";
import { TaskCard } from "./TaskCard";
import { PlusIcon, MoreHorizontalIcon, LockIcon, GripVerticalIcon } from "lucide-react";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onAddTask?: (columnId: string) => void;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  role?: Role;
  isFirstColumn?: boolean;
}

export function Column({ 
  column, 
  tasks, 
  onAddTask, 
  onTaskClick, 
  onDeleteTask, 
  role = 'agency',
  isFirstColumn = false
}: ColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
    disabled: role === 'client'
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const canAddTasks = role === 'agency' || (role === 'client' && isFirstColumn);
  const canEditColumn = role === 'agency';

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-gray-100 border-2 border-indigo-500 rounded-2xl w-[320px] min-w-[320px] h-[500px]"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-50/50 rounded-[32px] p-6 w-[320px] min-w-[320px] flex flex-col max-h-full border border-gray-200/60 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-3">
          {canEditColumn ? (
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors">
              <GripVerticalIcon size={14} />
            </div>
          ) : (
            <LockIcon size={12} className="text-gray-400" />
          )}
          <h3 className="font-semibold text-gray-800 text-sm">
            {column.title}
          </h3>
          <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        
        {canEditColumn && (
          <button className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200/50 transition-colors">
            <MoreHorizontalIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-[150px] space-y-3 p-1 custom-scrollbar">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onClick={() => onTaskClick(task)} 
              onDelete={() => onDeleteTask(task.id)}
              role={role}
              isEditable={role === 'agency' || (role === 'client' && isFirstColumn)}
            />
          ))}
        </SortableContext>
      </div>

      {canAddTasks && (
        <button
          onClick={() => onAddTask?.(column.id)}
          className="mt-4 flex items-center justify-center w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-800 bg-transparent hover:bg-gray-200/50 rounded-xl transition-all border border-dashed border-gray-300 hover:border-gray-400"
        >
          <PlusIcon className="w-4 h-4 mr-1.5" />
          New Task
        </button>
      )}
    </div>
  );
}
