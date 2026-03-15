"use client";

import { useState } from "react";
import { Task } from "@/types/kanban";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarViewProps {
  tasks: Task[];
}

export function CalendarView({ tasks }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => task.due_date && isSameDay(new Date(task.due_date), day));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mx-4 md:mx-8">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100">
        <h2 className="text-xl font-black text-gray-800 capitalize">
          {format(currentDate, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-2 hover:bg-slate-50 rounded-lg border border-gray-100 transition-colors text-gray-400 hover:text-indigo-600"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-2 hover:bg-slate-50 rounded-lg border border-gray-100 transition-colors text-gray-400 hover:text-indigo-600"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50/50">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 auto-rows-[120px]">
        {days.map((day, i) => {
          const dayTasks = getTasksForDay(day);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isToday = isSameDay(day, new Date());

          return (
            <div 
              key={i} 
              className={`p-2 border-r border-b border-gray-50 last:border-r-0 relative group transition-colors ${
                !isCurrentMonth ? "bg-gray-50/30" : "hover:bg-slate-50/30"
              }`}
            >
              <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                isToday ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : 
                isCurrentMonth ? "text-gray-600" : "text-gray-300"
              }`}>
                {format(day, "d")}
              </span>
              
              <div className="space-y-1 max-h-[80px] overflow-y-auto no-scrollbar">
                {dayTasks.map(task => (
                  <div 
                    key={task.id}
                    className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-[9px] font-bold text-indigo-700 truncate hover:scale-105 transition-transform cursor-pointer"
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
