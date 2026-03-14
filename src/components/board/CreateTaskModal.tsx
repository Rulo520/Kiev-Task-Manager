"use client";

import { useState } from "react";
import { XIcon, CalendarIcon, UsersIcon } from "lucide-react";
import { User } from "@/types/kanban";
import Image from "next/image";

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  role: "agency" | "client";
  columnId: string;
  agencyUsers: User[]; // Pass fetched users here
}

export function CreateTaskModal({ isOpen, onClose, onSubmit, role, columnId, agencyUsers = [] }: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = useState("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ 
      title, 
      description, 
      priority, 
      column_id: columnId,
      due_date: dueDate || null,
      assignees: selectedAssignees 
    });
    
    // Reset form
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setSelectedAssignees([]);
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">
            {role === "client" ? "Crear Nuevo Requerimiento" : "Crear Nueva Tarea"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Título
            </label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={role === "client" ? "Ej. Cambiar textos en la página de inicio" : "Título de la tarea"}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción {role === "client" && "(Detalles del requerimiento)"}
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Escribe los detalles aquí..."
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <CalendarIcon className="w-4 h-4 mr-1 text-gray-400" />
                Vencimiento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prioridad
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-white text-sm"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                {role === "agency" && <option value="urgent">Urgente</option>}
              </select>
            </div>
          </div>

          {role === "agency" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <UsersIcon className="w-4 h-4 mr-1 text-gray-400" />
                Asignar Responsables
              </label>
              
              {agencyUsers && agencyUsers.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-100 rounded-xl bg-gray-50/50">
                  {agencyUsers.map(user => {
                    const isSelected = selectedAssignees.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleAssignee(user.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isSelected 
                            ? "bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm" 
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                        } border`}
                      >
                        {user.profile_pic ? (
                          <Image src={user.profile_pic} alt={user.first_name || ""} width={16} height={16} className="rounded-full object-cover w-4 h-4" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[8px] font-bold">
                            {user.first_name?.[0]}
                          </div>
                        )}
                        {user.first_name} {user.last_name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start gap-2">
                  <span className="shrink-0 text-amber-500">⚠️</span>
                  <p>
                    No se encontraron usuarios. Por favor, asegúrate de haber configurado exactamente <b>GHL_ACCESS_TOKEN</b> y <b>GHL_LOCATION_ID</b> en Vercel.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-200 transition-all hover:shadow-md"
            >
              Guardar Requerimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
