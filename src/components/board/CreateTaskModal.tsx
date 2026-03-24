"use client";

import { useState } from "react";
import { X, Calendar, Flag, UserPlus, Loader2, AlertCircle, Tag, Plus, Trash2, Link as LinkIcon } from "lucide-react";
import { User, Role, Label } from "@/types/kanban";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: {
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    due_date: string | null;
    assignees: string[];
    labels: string[];
    checklists: string[];
    attachments: { name: string, url: string }[];
  }) => void;
  role: Role;
  columnId: string;
  agencyUsers: User[];
  syncError: string | null;
  allLabels?: Label[];
}

export function CreateTaskModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  role, 
  agencyUsers,
  syncError,
  allLabels = []
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [checklists, setChecklists] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<{ name: string, url: string }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newAttName, setNewAttName] = useState("");
  const [newAttUrl, setNewAttUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        priority,
        due_date: dueDate || null,
        assignees: selectedAssignees,
        labels: selectedLabels,
        checklists: checklists.filter(c => c.trim()),
        attachments: attachments.filter(a => a.name.trim() && a.url.trim()),
      });
      // Reset form
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setSelectedAssignees([]);
      setSelectedLabels([]);
      setChecklists([]);
      setAttachments([]);
      setNewChecklistItem("");
      setNewAttName("");
      setNewAttUrl("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setSelectedAssignees(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabels(prev => 
      prev.includes(labelId)
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">Nueva Tarea</h3>
            <p className="text-sm text-gray-500">Completa los detalles para comenzar.</p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Title and Description */}
          <div className="space-y-4">
            <input
              type="text"
              placeholder="¿Qué hay que hacer?"
              className="w-full text-xl font-bold text-gray-900 placeholder:text-gray-300 border-none focus:ring-0 p-0"
              value={title}
              autoFocus
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="Agrega una descripción más detallada..."
              className="w-full text-gray-600 placeholder:text-gray-300 border-none focus:ring-0 p-0 min-h-[100px] resize-none"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            />
          </div>

          <div className="h-px bg-gray-100" />

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Flag size={12} /> Prioridad
              </label>
              <select 
                className="w-full bg-gray-50 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                value={priority}
                onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={12} /> Fecha límite
              </label>
              <input 
                type="date"
                className="w-full bg-gray-50 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500"
                value={dueDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Allocation / Users */}
          {role === "agency" && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <UserPlus size={12} /> Asignar a
              </label>
              
              {syncError && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex gap-3 text-amber-800 text-xs">
                  <AlertCircle size={16} className="shrink-0" />
                  <p>{syncError}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {agencyUsers.map(user => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => toggleAssignee(user.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      selectedAssignees.includes(user.id)
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                        : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300"
                    }`}
                  >
                    {user.profile_pic ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={user.profile_pic} alt="" className="w-4 h-4 rounded-full" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px]">
                        {user.first_name[0]}
                      </div>
                    )}
                    {user.first_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Labels */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Tag size={12} /> Etiquetas
            </label>
            <div className="flex flex-wrap gap-2">
              {allLabels.map(label => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border transition-all ${
                    selectedLabels.includes(label.id)
                      ? "shadow-sm scale-105"
                      : "opacity-40 grayscale hover:opacity-100 hover:grayscale-0"
                  }`}
                  style={{ 
                    backgroundColor: selectedLabels.includes(label.id) ? `${label.color}20` : "transparent", 
                    color: label.color, 
                    borderColor: selectedLabels.includes(label.id) ? label.color : "#e5e7eb" 
                  }}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Checklist Creation */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Plus size={12} /> Lista de Pasos (Checklist)
            </label>
            <div className="space-y-2">
              {checklists.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 group bg-slate-50 p-2 rounded-xl border border-gray-100">
                  <span className="flex-1 text-sm text-gray-700 px-2">{item}</span>
                  <button 
                    type="button"
                    onClick={() => setChecklists(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-rose-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Ej: Revisar documentación"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newChecklistItem.trim()) {
                      e.preventDefault();
                      setChecklists(prev => [...prev, newChecklistItem.trim()]);
                      setNewChecklistItem("");
                    }
                  }}
                  className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <button 
                  type="button"
                  onClick={() => {
                    if (newChecklistItem.trim()) {
                      setChecklists(prev => [...prev, newChecklistItem.trim()]);
                      setNewChecklistItem("");
                    }
                  }}
                  className="bg-indigo-50 text-indigo-600 p-2 rounded-xl hover:bg-indigo-100 transition-colors"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Attachments Creation */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <LinkIcon size={12} /> Enlaces / Adjuntos
            </label>
            <div className="space-y-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 group bg-slate-50 p-2 rounded-xl border border-gray-100">
                  <div className="flex-1 flex items-center gap-2 px-2 overflow-hidden">
                    <span className="text-xs font-bold text-gray-800 shrink-0">{att.name}:</span>
                    <span className="text-[10px] text-indigo-500 truncate">{att.url}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-rose-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Nombre (ej: Drive)"
                    value={newAttName}
                    onChange={(e) => setNewAttName(e.target.value)}
                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <input 
                    type="url"
                    placeholder="https://..."
                    value={newAttUrl}
                    onChange={(e) => setNewAttUrl(e.target.value)}
                    className="flex-[2] bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (newAttName.trim() && newAttUrl.trim()) {
                        setAttachments(prev => [...prev, { name: newAttName.trim(), url: newAttUrl.trim() }]);
                        setNewAttName("");
                        setNewAttUrl("");
                      }
                    }}
                    className="bg-indigo-50 text-indigo-600 p-2 rounded-xl hover:bg-indigo-100 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-slate-50/50 flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
            {isSubmitting ? "Guardando..." : "Crear Tarea"}
          </button>
        </div>
      </div>
    </div>
  );
}
