"use client";

import { Task, Column } from "@/types/kanban";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, CheckSquare } from "lucide-react";
import { TaskOptionsDropdown } from "./TaskOptionsDropdown";

interface ListViewProps {
  tasks: Task[];
  columns: Column[];
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export function ListView({ tasks, columns, onTaskClick, onDeleteTask }: ListViewProps) {
  const getColumnTitle = (columnId: string) => {
    return columns.find(c => c.id === columnId)?.title || "Sin columna";
  };

  const priorityColors = {
    low: "text-emerald-600 bg-emerald-50",
    medium: "text-amber-600 bg-amber-50",
    high: "text-orange-600 bg-orange-50",
    urgent: "text-rose-600 bg-rose-50",
  };

  const handleCopyLink = (taskId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?userId=${taskId}`;
    navigator.clipboard.writeText(url);
    alert("Enlace copiado al portapapeles");
  };

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-indigo-100/20 overflow-hidden mx-4 md:mx-8">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50/50 border-b border-gray-100">
            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Requerimiento</th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Estado</th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Prioridad</th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Entrega</th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Progreso</th>
            <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Asignados</th>
            <th className="px-8 py-5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {tasks.map((task) => {
            const total = task.checklists?.length || 0;
            const completed = task.checklists?.filter(i => i.is_completed).length || 0;
            const percent = total > 0 ? (completed / total) * 100 : 0;

            return (
              <tr 
                key={task.id} 
                className="hover:bg-indigo-50/10 transition-all group cursor-pointer"
                onClick={() => onTaskClick(task)}
              >
                <td className="px-8 py-5">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-gray-800 text-[13px] group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{task.title}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider opacity-60">
                      Kiev ID-{task.id.slice(0, 4)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-tighter">
                    {getColumnTitle(task.column_id)}
                  </span>
                </td>
                <td className="px-6 py-5">
                  <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-6 py-5">
                  {task.due_date ? (
                    <div className="flex items-center gap-1.5 text-indigo-500 font-black text-[10px] uppercase tracking-tighter">
                      <CalendarIcon size={12} strokeWidth={2.5} />
                      {format(new Date(task.due_date), "dd MMM", { locale: es })}
                    </div>
                  ) : (
                    <span className="text-gray-200 text-[10px] font-black">—</span>
                  )}
                </td>
                <td className="px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 min-w-[60px] bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${percent === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    {total > 0 && (
                      <span className="text-[9px] font-black text-slate-400">{Math.round(percent)}%</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="flex -space-x-2">
                    {task.assignees.map((a) => (
                      <div key={a.user.id} className="h-7 w-7 rounded-lg border-2 border-white overflow-hidden bg-slate-50 shadow-sm" title={a.user.first_name}>
                         {a.user.profile_pic ? (
                           <img src={a.user.profile_pic} alt="" className="h-full w-full object-cover" />
                         ) : (
                           <div className="h-full w-full flex items-center justify-center text-[9px] font-black text-indigo-500">
                             {a.user.first_name[0]}
                           </div>
                         )}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                  <TaskOptionsDropdown 
                    onDelete={() => onDeleteTask(task.id)}
                    onEdit={() => onTaskClick(task)}
                    onCopyLink={() => handleCopyLink(task.id)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
