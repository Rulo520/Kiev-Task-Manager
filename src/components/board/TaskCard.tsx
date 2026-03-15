"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/types/kanban";
import { MessageSquare, Paperclip, Calendar, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface TaskCardProps {
  task: Task;
}

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
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const priorityColors = {
    low: "bg-emerald-100 text-emerald-700 border-emerald-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    urgent: "bg-rose-100 text-rose-700 border-rose-200",
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-white border-2 border-indigo-500 rounded-2xl h-[160px] cursor-grabbing shadow-inner"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 cursor-grab active:cursor-grabbing border-b-2 border-b-gray-100/50"
    >
      <div className="flex flex-col gap-3">
        {/* Priority Badge */}
        <div className="flex justify-between items-start">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${priorityColors[task.priority]}`}>
            {task.priority === "urgent" ? "🚨 Urgente" : task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
          </span>
          <button className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal size={14} />
          </button>
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <h4 className="font-bold text-gray-800 leading-tight group-hover:text-indigo-600 transition-colors">
            {task.title}
          </h4>
          {task.description && (
            <p className="text-xs text-gray-400 line-clamp-2 font-medium">
              {task.description}
            </p>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-gray-50">
          <div className="flex items-center gap-3 text-gray-400">
            <div className="flex items-center gap-1 hover:text-indigo-500 transition-colors">
              <MessageSquare size={12} />
              <span className="text-[10px] font-bold">0</span>
            </div>
            <div className="flex items-center gap-1 hover:text-indigo-500 transition-colors">
              <Paperclip size={12} />
              <span className="text-[10px] font-bold">0</span>
            </div>
            {task.due_date && (
              <div className="flex items-center gap-1 text-indigo-500 font-bold">
                <Calendar size={12} />
                <span className="text-[10px]">
                  {format(new Date(task.due_date), "MMM d", { locale: es })}
                </span>
              </div>
            )}
          </div>

          {/* Assignees */}
          <div className="flex -space-x-1.5 overflow-hidden">
            {task.assignees && task.assignees.length > 0 ? (
              task.assignees
                .slice(0, 3)
                .map((assignee) => (
                  <div 
                    key={assignee.user.id}
                    className="relative inline-block"
                    title={`${assignee.user.first_name} ${assignee.user.last_name}`}
                  >
                    {assignee.user.profile_pic ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        className="h-6 w-6 rounded-full border-2 border-white ring-1 ring-gray-100 object-cover"
                        src={assignee.user.profile_pic}
                        alt=""
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full border-2 border-white bg-indigo-50 flex items-center justify-center ring-1 ring-gray-100">
                        <span className="text-[8px] font-black text-indigo-600">
                          {assignee.user.first_name[0]}{assignee.user.last_name[0]}
                        </span>
                      </div>
                    )}
                  </div>
                ))
            ) : (
              <div className="h-6 w-6 rounded-full border-2 border-dashed border-gray-100 flex items-center justify-center">
                <UserPlus size={10} className="text-gray-200" />
              </div>
            )}
            {task.assignees && task.assignees.length > 3 && (
              <div className="h-6 w-6 rounded-full border-2 border-white bg-gray-50 flex items-center justify-center text-[8px] font-bold text-gray-400 ring-1 ring-gray-100">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { UserPlus } from "lucide-react";
