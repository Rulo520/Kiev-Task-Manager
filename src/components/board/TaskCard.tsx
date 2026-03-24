"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, Role } from "@/types/kanban";
import { Calendar, CheckSquare, MessageCircle, Paperclip, LockIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TaskOptionsDropdown } from "./TaskOptionsDropdown";

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onDelete?: () => void;
  role?: Role;
  isEditable?: boolean;
  isLastColumn?: boolean;
  onToggleComplete?: (task: Task) => void;
}

export function TaskCard({ 
  task, 
  onClick, 
  onDelete, 
  role = 'agency', 
  isEditable = true,
  isLastColumn = false,
  onToggleComplete
}: TaskCardProps) {
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
    disabled: role === 'client' // V8.0: Clients cannot drag/move
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const priorityColors = {
    low: "bg-emerald-100 text-emerald-700 border-emerald-200 shadow-emerald-50/50",
    medium: "bg-amber-100 text-amber-700 border-amber-200 shadow-amber-50/50",
    high: "bg-orange-100 text-orange-700 border-orange-200 shadow-orange-50/50",
    urgent: "bg-rose-100 text-rose-700 border-rose-200 shadow-rose-50/50",
  };

  // Progress calculation
  const totalItems = task.checklists?.length || 0;
  const completedItems = task.checklists?.filter(i => i.is_completed).length || 0;
  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const isComplete = totalItems > 0 && completedItems === totalItems;

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-white border-2 border-indigo-500 rounded-2xl h-[160px] cursor-grabbing shadow-inner"
      />
    );
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?userId=${task.id}`;
    navigator.clipboard.writeText(url);
    alert("Enlace copiado al portapapeles");
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isEditable ? listeners : {})} // V8.0 Disable listeners if not editable
      onClick={(e) => {
        onClick?.();
      }}
      className={`group relative bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-100 transition-all duration-300 ${isEditable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} border-b-2 border-b-gray-100/50`}
    >
      {!isEditable && role === 'client' && (
        <div className="absolute top-2 right-2 z-10 bg-slate-100 text-slate-400 p-1 rounded-md" title="Mover a otra fase está bloqueado para clientes">
          <LockIcon size={10} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {/* Top Bar: Badges & Menu */}
        <div className="flex justify-between items-start gap-2">
           <div className="flex flex-wrap gap-1">
             <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${priorityColors[task.priority]}`}>
               {task.priority === "urgent" ? "🚨 Urgente" : task.priority}
             </span>
           </div>
           
           {/* Only show options if editable or agency */}
           {(isEditable || role === 'agency') && (
             <TaskOptionsDropdown 
                onDelete={onDelete || (() => {})} 
                onEdit={() => onClick?.()} 
                onCopyLink={handleCopyLink}
             />
           )}
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <div className="flex items-start gap-2 group/title">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isEditable) onToggleComplete?.(task);
              }}
              className={`mt-0.5 min-w-4 min-h-4 w-4 h-4 rounded-md border flex items-center justify-center transition-all duration-200 ${
                isLastColumn 
                  ? 'bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/20' 
                  : 'bg-white border-gray-300 hover:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20'
              } ${!isEditable ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              title={isLastColumn ? "Marcar como incompleta" : "Marcar como completada"}
            >
              {isLastColumn && <CheckSquare size={10} strokeWidth={4} className="text-white" />}
            </button>
            <h4 className={`font-bold text-gray-800 leading-[1.3] text-[13px] group-hover:text-indigo-600 transition-colors ${
              isLastColumn ? "line-through text-gray-400 opacity-60 decoration-emerald-500/50 decoration-2" : ""
            }`}>
              {task.title}
            </h4>
            {!isEditable && role === 'client' && <span className="text-[8px] bg-slate-50 text-slate-400 px-1 rounded uppercase font-black mt-1">Read Only</span>}
          </div>
          {task.description && (
            <p className="text-[11px] text-gray-400 line-clamp-2 font-medium leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Dynamic Activity Area (V6 Progress Bar) */}
        {totalItems > 0 && (
          <div className="space-y-1.5 mt-1">
            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
              <span className={isComplete ? "text-emerald-500" : "text-slate-400"}>Progreso</span>
              <span className={isComplete ? "text-emerald-500" : "text-indigo-500"}>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50">
              <div 
                className={`h-full transition-all duration-700 ease-out rounded-full ${isComplete ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]"}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="flex items-center gap-3 mt-1">
          {totalItems > 0 && (
            <div className={`flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md transition-colors ${isComplete ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"}`}>
              <CheckSquare size={10} strokeWidth={2.5} />
              {completedItems}/{totalItems}
            </div>
          )}
          {task.comments && task.comments.length > 0 && (
            <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 bg-slate-50/50 px-1.5 py-0.5 rounded-md">
              <MessageCircle size={10} strokeWidth={2.5} />
              {task.comments.length}
            </div>
          )}
          {task.attachments && task.attachments.length > 0 && (
            <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 bg-slate-50/50 px-1.5 py-0.5 rounded-md">
              <Paperclip size={10} strokeWidth={2.5} />
              {task.attachments.length}
            </div>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="pt-3 flex flex-col gap-2.5 border-t border-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {task.due_date && (
                <div className="flex items-center gap-1 text-indigo-500 font-black">
                  <Calendar size={10} strokeWidth={2.5} />
                  <span className="text-[9px] uppercase tracking-tighter">
                    {format(new Date(task.due_date), "MMM d", { locale: es })}
                  </span>
                </div>
              )}
              <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                {format(new Date(task.created_at), "dd MMM")}
              </div>
            </div>
            
            {/* Creator Avatar Small */}
            <div className="flex items-center gap-1.5 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[60px]">
                {task.creator?.first_name || "Agencia"}
              </span>
              <div className="h-4 w-4 rounded-full bg-slate-100 flex items-center justify-center border border-white shadow-sm overflow-hidden">
                {task.creator?.profile_pic ? (
                  <img src={task.creator.profile_pic} alt="" className="object-cover h-full w-full" />
                ) : (
                  <span className="text-[7px] font-black text-indigo-600">{task.creator?.first_name[0]}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {/* Assignees */}
            <div className="flex -space-x-1.5 overflow-hidden">
              {task.assignees && task.assignees.length > 0 ? (
                task.assignees
                  .slice(0, 4)
                  .map((assignee) => (
                    <div 
                      key={assignee.user.id}
                      className="relative inline-block hover:scale-110 transition-transform duration-200"
                      title={`${assignee.user.first_name} ${assignee.user.last_name}`}
                    >
                      {assignee.user.profile_pic ? (
                        <img
                          className="h-6 w-6 rounded-lg border-2 border-white object-cover shadow-sm bg-white"
                          src={assignee.user.profile_pic}
                          alt=""
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-lg border-2 border-white bg-indigo-50 flex items-center justify-center shadow-sm">
                          <span className="text-[8px] font-black text-indigo-600 uppercase">
                            {assignee.user.first_name[0]}{assignee.user.last_name[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                <div className="h-6 w-6 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center opacity-40">
                  <span className="text-[10px] text-slate-300">+</span>
                </div>
              )}
              {task.assignees.length > 4 && (
                <div className="h-6 w-6 rounded-lg border-2 border-white bg-slate-100 flex items-center justify-center shadow-sm z-10">
                  <span className="text-[8px] font-black text-slate-500">+{task.assignees.length - 4}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-1 pl-2 max-w-[60%]">
              {task.labels && task.labels.map((item) => (
                <span 
                  key={item.label.id} 
                  className="px-1.5 py-0.5 rounded-[4px] text-[7px] font-black uppercase tracking-tight shadow-sm"
                  style={{ backgroundColor: `${item.label.color}10`, color: item.label.color, border: `1px solid ${item.label.color}30` }}
                >
                  {item.label.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
