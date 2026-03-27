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
  isAnimatingOut?: boolean;
}

export function TaskCard({ 
  task, 
  onClick, 
  onDelete, 
  role = 'agency', 
  isEditable = true,
  isLastColumn = false,
  onToggleComplete,
  isAnimatingOut = false
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
      className={`group relative bg-white border border-gray-200 rounded-xl p-3.5 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-200 transition-all duration-300 ${isEditable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} border-b-2 border-b-gray-200/50 ${isAnimatingOut ? 'animate-task-fly-out' : ''}`}
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
             <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border shadow-sm ${priorityColors[task.priority]}`}>
               {task.priority === "urgent" ? "🚨 Urgente" : task.priority}
             </span>
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
            <h4 className={`font-bold text-gray-900 leading-[1.2] text-[12px] group-hover:text-indigo-600 transition-colors ${
              isLastColumn ? "line-through text-gray-400 opacity-60 decoration-emerald-500/50 decoration-2" : ""
            }`}>
              {task.title} {task.creator?.company_name && (
                <span className="text-indigo-500 font-bold ml-1">
                  | {task.creator.company_name}
                </span>
              )}
            </h4>
            {!isEditable && role === 'client' && <span className="text-[7px] bg-slate-100 text-slate-400 px-1 rounded uppercase font-black mt-0.5">Read Only</span>}
          </div>
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
            <div className="flex items-center gap-2">
              {/* Public/External Comments */}
              {task.comments.filter(c => c.type === 'external').length > 0 && (
                <div className="flex items-center gap-1 text-[9px] font-black text-indigo-400 bg-indigo-50/50 px-1.5 py-0.5 rounded-md border border-indigo-100/20">
                  <MessageCircle size={10} strokeWidth={2.5} />
                  {task.comments.filter(c => c.type === 'external').length}
                </div>
              )}
              
              {/* Internal Comments (Agency Only) */}
              {role === 'agency' && task.comments.filter(c => c.type === 'internal').length > 0 && (
                <div className="flex items-center gap-1 text-[9px] font-black text-amber-500 bg-amber-50/50 px-1.5 py-0.5 rounded-md border border-amber-100/20">
                  <LockIcon size={10} strokeWidth={2.5} />
                  {task.comments.filter(c => c.type === 'internal').length}
                </div>
              )}
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
        <div className="pt-2.5 flex items-center justify-between border-t border-slate-100">
           <div className="flex items-center gap-3">
             {task.due_date && (() => {
               const now = new Date();
               const due = new Date(task.due_date);
               const diff = due.getTime() - now.getTime();
               const isOverdue = diff < 0;
               const isSoon = diff > 0 && diff < 24 * 60 * 60 * 1000;
               
               let colorClass = "text-indigo-500 bg-slate-50";
               if (isOverdue) colorClass = "text-rose-600 bg-rose-50";
               else if (isSoon) colorClass = "text-amber-600 bg-amber-50";

               return (
                 <div className={`flex items-center gap-1 font-black px-1.5 py-0.5 rounded-md ${colorClass}`}>
                   <Calendar size={10} strokeWidth={2.5} />
                   <span className="text-[8px] uppercase tracking-tighter">
                     {format(due, "MMM d, HH:mm", { locale: es })}
                   </span>
                 </div>
               );
             })()}
           </div>
           
           {/* Assignees at the bottom right */}
           <div className="flex -space-x-1.5 overflow-hidden">
             {task.assignees && task.assignees.length > 0 && (
               task.assignees
                 .slice(0, 3)
                 .map((assignee) => (
                   <div 
                     key={assignee.user.id}
                     className="relative inline-block hover:scale-110 transition-transform duration-200"
                     title={`${assignee.user.first_name} ${assignee.user.last_name}`}
                   >
                     {assignee.user.profile_pic ? (
                       <img
                         className="h-5 w-5 rounded-lg border border-white object-cover shadow-sm bg-white"
                         src={assignee.user.profile_pic}
                         alt=""
                       />
                     ) : (
                       <div className="h-5 w-5 rounded-lg border border-white bg-indigo-50 flex items-center justify-center shadow-sm">
                         <span className="text-[7px] font-black text-indigo-600">
                           {assignee.user.first_name[0]}
                         </span>
                       </div>
                     )}
                   </div>
                 ))
             )}
             {task.assignees.length > 3 && (
               <div className="h-5 w-5 rounded-lg border border-white bg-slate-100 flex items-center justify-center shadow-sm z-10">
                 <span className="text-[7px] font-black text-slate-500">+{task.assignees.length - 3}</span>
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
