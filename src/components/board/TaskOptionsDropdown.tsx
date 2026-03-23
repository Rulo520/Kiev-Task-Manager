"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Trash2, Edit3, Link, Copy } from "lucide-react";

interface TaskOptionsDropdownProps {
  onDelete: () => void;
  onEdit: () => void;
  onCopyLink: () => void;
}

export function TaskOptionsDropdown({ onDelete, onEdit, onCopyLink }: TaskOptionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={toggleDropdown}
        className={`p-1.5 rounded-lg transition-all duration-200 ${isOpen ? "bg-indigo-100 text-indigo-600 scale-110" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100 opacity-0 group-hover:opacity-100"}`}
      >
        <MoreHorizontal size={16} strokeWidth={2.5} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl shadow-indigo-100/50 border border-slate-100 py-2 z-[100] animate-in fade-in zoom-in duration-150 origin-top-right">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); setIsOpen(false); }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors"
          >
            <Edit3 size={14} className="opacity-70" />
            Editar Requerimiento
          </button>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onCopyLink(); setIsOpen(false); }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors"
          >
            <Link size={14} className="opacity-70" />
            Copiar Enlace
          </button>

          <div className="h-px bg-slate-50 my-1 mx-2" />

          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); setIsOpen(false); }}
            className="w-full px-4 py-2.5 text-left text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-3 transition-colors"
          >
            <Trash2 size={14} className="opacity-70" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
