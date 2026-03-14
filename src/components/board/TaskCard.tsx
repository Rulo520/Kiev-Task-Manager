"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { CalendarIcon, MessageSquareIcon, PaperclipIcon } from "lucide-react";
import Image from "next/image";
import { Task } from "@/types/kanban";

interface TaskCardProps {
  task: Task;
}

const priorityColors = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export function TaskCard({ task }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 border-2 border-indigo-500 rounded-xl bg-white shadow-xl h-[120px]"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group relative`}
    >
      <div className="flex justify-between items-start mb-2">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            priorityColors[task.priority]
          }`}
        >
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
      </div>

      <h4 className="text-sm font-semibold text-gray-800 mb-1">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center space-x-3 text-gray-400">
          <div className="flex items-center text-xs">
            <MessageSquareIcon className="w-3 h-3 mr-1" />
            <span>0</span>
          </div>
          <div className="flex items-center text-xs">
            <PaperclipIcon className="w-3 h-3 mr-1" />
            <span>0</span>
          </div>
          {task.due_date && (
            <div className="flex items-center text-xs">
              <CalendarIcon className="w-3 h-3 mr-1" />
              <span>{format(new Date(task.due_date), "MMM d")}</span>
            </div>
          )}
        </div>

        {/* Assignees Avatars */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex -space-x-2 overflow-hidden">
            {task.assignees.map((assignee, idx) => (
              <div
                key={assignee.user.id}
                className="relative inline-block h-6 w-6 rounded-full ring-2 ring-white"
                title={`${assignee.user.first_name} ${assignee.user.last_name}`}
              >
                {assignee.user.profile_pic ? (
                  <Image
                    src={assignee.user.profile_pic}
                    alt={assignee.user.first_name}
                    fill
                    className="object-cover rounded-full"
                  />
                ) : (
                  <div className="h-full w-full bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-full text-[10px] font-bold">
                    {assignee.user.first_name?.[0]}
                    {assignee.user.last_name?.[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
