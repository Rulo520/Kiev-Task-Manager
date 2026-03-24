import { useState, useRef, useEffect } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, Column as ColumnType, Role } from "@/types/kanban";
import { TaskCard } from "./TaskCard";
import { PlusIcon, MoreHorizontalIcon, LockIcon, GripVerticalIcon, Edit2Icon, Trash2Icon, ArrowUpIcon, ArrowDownIcon, EyeOffIcon, EyeIcon } from "lucide-react";

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onAddTask?: (columnId: string) => void;
  onTaskClick: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateColumn?: (id: string, title: string, is_visible_to_client?: boolean) => void;
  onDeleteColumn?: (id: string) => void;
  role?: Role;
  isFirstColumn?: boolean;
  isLastColumn?: boolean;
  onToggleComplete?: (task: Task) => void;
}

export function Column({ 
  column, 
  tasks, 
  onAddTask, 
  onTaskClick, 
  onDeleteTask, 
  onUpdateColumn,
  onDeleteColumn,
  role = 'agency',
  isFirstColumn = false,
  isLastColumn = false,
  onToggleComplete
}: ColumnProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const handleRename = () => {
    const newTitle = prompt("Nuevo nombre de la fase:", column.title);
    if (newTitle && newTitle !== column.title) {
      onUpdateColumn?.(column.id, newTitle, column.is_visible_to_client);
    }
    setShowMenu(false);
  };

  const handleToggleVisibility = () => {
    const newVisibility = !column.is_visible_to_client;
    onUpdateColumn?.(column.id, column.title, newVisibility);
    setShowMenu(false);
  };

  const canAddTasks = role === 'agency' || (role === 'client' && isFirstColumn);
  const canEditColumn = role === 'agency';
  const isPrivate = column.is_visible_to_client === false;

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-gray-100 border-2 border-indigo-500 rounded-2xl w-[320px] min-w-[320px] h-full"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-50/50 rounded-[32px] p-6 w-[320px] min-w-[320px] flex flex-col max-h-full border border-gray-200/60 shadow-sm transition-shadow hover:shadow-md ${isPrivate ? 'border-amber-200/50' : ''}`}
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
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-800 text-sm">
                {column.title}
              </h3>
              {isPrivate && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded text-[8px] font-black uppercase tracking-widest">
                  <EyeOffIcon size={8} /> Solo Agencia
                </span>
              )}
            </div>
          </div>
          <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        
        {canEditColumn && (
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200/50 transition-colors"
            >
              <MoreHorizontalIcon className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in duration-200">
                <button 
                  onClick={handleRename}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                >
                  <Edit2Icon size={14} /> Renombrar Fase
                </button>
                <button 
                  onClick={handleToggleVisibility}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                >
                  {isPrivate ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />} 
                  {isPrivate ? "Hacer Visible a Cliente" : "Ocultar a Cliente"}
                </button>
                <div className="h-px bg-gray-50 my-1" />
                <button 
                  onClick={() => { setSortOrder('newest'); setShowMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 ${sortOrder === 'newest' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:bg-slate-50'}`}
                >
                  <ArrowDownIcon size={14} /> Orden: Más nuevos
                </button>
                <button 
                  onClick={() => { setSortOrder('oldest'); setShowMenu(false); }}
                  className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 ${sortOrder === 'oldest' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-600 hover:bg-slate-50'}`}
                >
                  <ArrowUpIcon size={14} /> Orden: Más antiguos
                </button>
                <div className="h-px bg-gray-50 my-1" />
                <button 
                  onClick={() => { onDeleteColumn?.(column.id); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                >
                  <Trash2Icon size={14} /> Eliminar Fase
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-[150px] space-y-3 p-1 custom-scrollbar">
        <SortableContext items={sortedTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {sortedTasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onClick={() => onTaskClick(task)} 
              onDelete={() => onDeleteTask(task.id)}
              role={role}
              isEditable={role === 'agency' || (role === 'client' && isFirstColumn)}
              isLastColumn={isLastColumn}
              onToggleComplete={onToggleComplete}
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
          Nueva Tarea
        </button>
      )}
    </div>
  );
}
