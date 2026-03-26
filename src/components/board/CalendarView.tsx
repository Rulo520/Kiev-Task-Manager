"use client";

import { useState, useEffect } from "react";
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
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfDay,
  endOfDay
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, LayoutGrid, CalendarRange, Trash2 } from "lucide-react";

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

type ViewMode = "day" | "week" | "month";

export function CalendarView({ tasks, onTaskClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load persistence
  useEffect(() => {
    const savedMode = localStorage.getItem("calendar-view-mode") as ViewMode;
    if (savedMode && ["day", "week", "month"].includes(savedMode)) {
      setViewMode(savedMode);
    }
    setIsLoaded(true);
  }, []);

  // Save persistence
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("calendar-view-mode", viewMode);
    }
  }, [viewMode, isLoaded]);

  const handlePrev = () => {
    if (viewMode === "month") setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === "month") setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const getTasksForDay = (day: Date) => {
    return tasks
      .filter(task => task.due_date && isSameDay(new Date(task.due_date), day))
      .sort((a, b) => {
        const dateA = new Date(a.due_date!).getTime();
        const dateB = new Date(b.due_date!).getTime();
        return dateA - dateB;
      });
  };

  const renderTask = (task: Task, isCompact = true) => (
    <div 
      key={task.id}
      onClick={(e) => {
        e.stopPropagation();
        onTaskClick?.(task);
      }}
      className={`group/task px-2 py-1.5 rounded-lg border shadow-sm transition-all hover:scale-[1.02] cursor-pointer flex flex-col gap-1 ${
        task.priority === 'urgent' ? 'bg-rose-50 border-rose-100 text-rose-700' :
        task.priority === 'high' ? 'bg-orange-50 border-orange-100 text-orange-700' :
        'bg-indigo-50 border-indigo-100 text-indigo-700'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[10px] font-black truncate flex-1 uppercase tracking-tight ${isCompact ? 'line-clamp-1' : ''}`}>
          {task.title}
        </span>
        <span className="opacity-40 group-hover/task:opacity-100 transition-opacity">
          {task.priority === 'urgent' && "🚨"}
        </span>
      </div>
      {task.creator?.company_name && (
        <span className={`text-[8px] font-bold opacity-70 uppercase tracking-widest truncate ${isCompact ? 'hidden group-hover/task:block' : ''}`}>
           {task.creator.company_name}
        </span>
      )}
    </div>
  );

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map(day => (
            <div key={day} className="py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1 min-h-[600px]">
          {days.map((day, i) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isToday = isSameDay(day, new Date());

            return (
              <div 
                key={i} 
                className={`p-3 border-r border-b border-gray-100 last:border-r-0 relative group transition-colors min-h-[120px] ${
                  !isCurrentMonth ? "bg-gray-50/30" : "hover:bg-slate-50/10 bg-white"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[11px] font-black w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                    isToday ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : 
                    isCurrentMonth ? "text-gray-600 bg-gray-50 group-hover:bg-gray-100" : "text-gray-300"
                  }`}>
                    {format(day, "d")}
                  </span>
                </div>
                
                <div className="space-y-1.5 max-h-[110px] overflow-y-auto no-scrollbar pb-2">
                  {dayTasks.map(task => renderTask(task, true))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate);
    const endDate = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="flex flex-col h-full min-h-[500px]">
        <div className="grid grid-cols-7 flex-1">
          {days.map((day, i) => {
            const dayTasks = getTasksForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div key={i} className={`flex flex-col border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-indigo-50/10' : ''}`}>
                <div className={`py-4 text-center border-b border-gray-100 ${isToday ? 'bg-indigo-50/30' : 'bg-gray-50/50'}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                    {format(day, "EEE", { locale: es })}
                  </div>
                  <div className={`text-xl font-black inline-flex items-center justify-center w-10 h-10 rounded-xl ${
                    isToday ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'text-gray-800'
                  }`}>
                    {format(day, "d")}
                  </div>
                </div>
                <div className="p-3 flex-1 space-y-2 bg-white/50 backdrop-blur-sm">
                  {dayTasks.map(task => renderTask(task, false))}
                  {dayTasks.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 py-20 grayscale">
                      <CalendarIcon size={32} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayTasks = getTasksForDay(currentDate);
    const isToday = isSameDay(currentDate, new Date());

    return (
      <div className="bg-white p-8 min-h-[400px]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-6 mb-10 border-b border-gray-100 pb-8">
            <div className={`text-4xl font-black w-24 h-24 flex items-center justify-center rounded-3xl shadow-2xl ${
              isToday ? "bg-indigo-600 text-white shadow-indigo-200" : "bg-gray-100 text-gray-800"
            }`}>
              {format(currentDate, "d")}
            </div>
            <div>
              <div className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">
                {format(currentDate, "EEEE", { locale: es })}
              </div>
              <h3 className="text-3xl font-black text-gray-900 capitalize">
                {format(currentDate, "MMMM yyyy", { locale: es })}
              </h3>
            </div>
          </div>
          
          <div className="space-y-4">
            {dayTasks.length > 0 ? (
              dayTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => onTaskClick?.(task)}
                  className="p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-xl transition-all duration-300 flex items-center justify-between group cursor-pointer border-l-4 border-l-indigo-500"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                        task.priority === 'urgent' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                        task.priority === 'high' ? 'bg-orange-50 border-orange-100 text-orange-600' :
                        'bg-indigo-50 border-indigo-100 text-indigo-600'
                      }`}>
                        {task.priority || 'Normal'}
                      </span>
                      {task.due_date && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                          <Clock size={12} />
                          {format(new Date(task.due_date), "HH:mm")}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {task.title}
                    </h4>
                    {task.creator?.company_name && (
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                        Cliente: {task.creator.company_name}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={24} className="text-gray-200 group-hover:text-indigo-400 transition-colors" />
                </div>
              ))
            ) : (
              <div className="py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                <CalendarIcon className="mx-auto h-12 w-12 text-gray-200 mb-4" />
                <p className="text-gray-400 font-bold uppercase tracking-widest">Sin tareas programadas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isLoaded) return null;

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl overflow-hidden mx-4 md:mx-8 mb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between p-8 gap-6 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
            <CalendarIcon className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 capitalize leading-tight">
              {viewMode === "month" ? format(currentDate, "MMMM yyyy", { locale: es }) :
               viewMode === "week" ? `${format(startOfWeek(currentDate), "d MMM")} - ${format(endOfWeek(currentDate), "d MMM")}` :
               format(currentDate, "d MMMM, yyyy", { locale: es })}
            </h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-0.5">
              Planificación Estratégica
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Navigator */}
          <div className="flex items-center bg-gray-50 rounded-2xl p-1.5 border border-gray-100">
            <button 
              onClick={handlePrev}
              className="p-2.5 hover:bg-white hover:text-indigo-600 rounded-xl transition-all text-gray-400 hover:shadow-sm"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-white rounded-lg transition-all"
            >
              Hoy
            </button>
            <button 
              onClick={handleNext}
              className="p-2.5 hover:bg-white hover:text-indigo-600 rounded-xl transition-all text-gray-400 hover:shadow-sm"
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="h-8 w-px bg-gray-100 hidden md:block" />

          {/* View Toggles */}
          <div className="flex bg-gray-50 rounded-2xl p-1.5 border border-gray-100">
            {[
              { id: 'day' as ViewMode, label: 'Día', icon: Clock },
              { id: 'week' as ViewMode, label: 'Semana', icon: CalendarRange },
              { id: 'month' as ViewMode, label: 'Mes', icon: LayoutGrid },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  viewMode === mode.id 
                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100" 
                  : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <mode.icon size={14} strokeWidth={2.5} />
                <span className="hidden lg:inline">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white overflow-hidden">
        {viewMode === "month" && renderMonthView()}
        {viewMode === "week" && renderWeekView()}
        {viewMode === "day" && renderDayView()}
      </div>
    </div>
  );
}
