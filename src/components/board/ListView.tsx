"use client";

import { Task, Column } from "@/types/kanban";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MoreHorizontal, Calendar as CalendarIcon } from "lucide-react";

interface ListViewProps {
  tasks: Task[];
  columns: Column[];
}

export function ListView({ tasks, columns }: ListViewProps) {
  const getColumnTitle = (columnId: string) => {
    return columns.find(c => c.id === columnId)?.title || "Sin columna";
  };

  const priorityColors = {
    low: "text-emerald-600 bg-emerald-50",
    medium: "text-amber-600 bg-amber-50",
    high: "text-orange-600 bg-orange-50",
    urgent: "text-rose-600 bg-rose-50",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mx-4 md:mx-8">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50/50 border-b border-gray-100">
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Tarea</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Prioridad</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Entrega</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Asignados</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Etiquetas</th>
            <th className="px-6 py-4"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-slate-50/50 transition-colors group">
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <span className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{task.title}</span>
                  <span className="text-[10px] text-gray-400 font-medium">Creado el {format(new Date(task.created_at), "dd MMM yyyy", { locale: es })}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                  {getColumnTitle(task.column_id)}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${priorityColors[task.priority]}`}>
                  {task.priority.toUpperCase()}
                </span>
              </td>
              <td className="px-6 py-4">
                {task.due_date ? (
                  <div className="flex items-center gap-1.5 text-indigo-500 font-bold text-[10px]">
                    <CalendarIcon size={12} />
                    {format(new Date(task.due_date), "dd/MM/yy")}
                  </div>
                ) : (
                  <span className="text-gray-300 text-[10px]">-</span>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="flex -space-x-1.5">
                  {task.assignees.map((a) => (
                    <div key={a.user.id} className="h-6 w-6 rounded-full border-2 border-white overflow-hidden bg-gray-100" title={a.user.first_name}>
                       {a.user.profile_pic ? (
                         <img src={a.user.profile_pic} alt="" className="h-full w-full object-cover" />
                       ) : (
                         <div className="h-full w-full flex items-center justify-center text-[8px] font-bold text-gray-400">
                           {a.user.first_name[0]}
                         </div>
                       )}
                    </div>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {task.labels?.map((l: { label: { id: string; name: string; color: string } }) => (
                    <span 
                      key={l.label.id}
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: l.label.color }}
                      title={l.label.name}
                    />
                  ))}
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <button className="text-gray-300 hover:text-gray-600 transition-colors">
                  <MoreHorizontal size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
