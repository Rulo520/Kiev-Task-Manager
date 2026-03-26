"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  X, MapPin, Calendar, CheckSquare, Clock, MessageSquare, Plus, 
  CheckCircle2, Circle, Trash2, Send, Loader2, Lock, Edit2, Eye,
  Paperclip, Link as LinkIcon, Tag
} from "lucide-react";
import { Task, ChecklistItem, Attachment, Comment, User, Role, Label } from "@/types/kanban";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  role: Role;
  currentUser: User;
  isFirstColumn: boolean;
  agencyUsers?: User[];
  availableLabels?: Label[];
  onLabelCreated?: (label: Label) => void;
  isLastColumn?: boolean;
  onToggleComplete?: (task: Task) => void;
  onUpdateTask?: (task: Task) => void;
}

export function TaskDetailModal({ isOpen, onClose, task: initialTask, role, currentUser, isFirstColumn, agencyUsers = [], availableLabels = [], onLabelCreated, isLastColumn = false, onToggleComplete, onUpdateTask }: TaskDetailModalProps) {
  const [task, setTask] = useState<Task>(initialTask);
  const [serverTask, setServerTask] = useState<Task>(initialTask);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChat, setActiveChat] = useState<"external" | "internal">("external");
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newAttachmentName, setNewAttachmentName] = useState("");
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tempAssigneeIds, setTempAssigneeIds] = useState<string[]>(initialTask.assignees?.map(a => a.user.id) || []);
  const [tempLabelIds, setTempLabelIds] = useState<string[]>(initialTask.labels?.map(l => l.label.id) || []);

  // Tag state
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");
  const [isSubmittingLabel, setIsSubmittingLabel] = useState(false);

  const fetchTaskDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/tasks/${initialTask.id}`, {
        headers: { "x-test-user": currentUser.id }
      });
      if (!res.ok) throw new Error("Failed to fetch task details");
      const data = await res.json();
      setTask(data);
      setServerTask(data);
      setTempAssigneeIds(data.assignees?.map((a: any) => a.user.id) || []);
      setTempLabelIds(data.labels?.map((l: any) => l.label.id) || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [initialTask.id]);

  useEffect(() => {
    if (isOpen) {
      fetchTaskDetails();
    }
  }, [isOpen, fetchTaskDetails]);

  const isDirty = 
    task.title !== serverTask.title ||
    (task.description || "") !== (serverTask.description || "") ||
    task.due_date !== serverTask.due_date ||
    JSON.stringify(tempAssigneeIds.sort()) !== JSON.stringify((serverTask.assignees?.map(a => a.user.id) || []).sort()) ||
    JSON.stringify(tempLabelIds.sort()) !== JSON.stringify((serverTask.labels?.map(l => l.label.id) || []).sort());

  // V9.4 - Esc Key to Close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleConfirmClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
    }
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, isDirty]);

  const handleConfirmClose = () => {
    if (isDirty) {
      const confirmSave = window.confirm("¿Deseas guardar los cambios antes de salir?");
      if (confirmSave) {
        handleSaveAll(true);
      } else {
        // We use a custom logic here because window.confirm only has OK/Cancel.
        // If they click "Cancel" in confirm(), they stay. If they click "OK", they save.
        // To allow "Discard without saving", we'd need a custom modal.
        // Given the user's request: "aparecer un popup preguntando si quiere guardar los cambios o prefiere cancelar"
        // I'll implement a simple two-step with a clear message or just the standard confirm.
        // Actually, let's stick to the simplest interpretation first:
        if (window.confirm("¿Estás seguro de que quieres descartar los cambios?")) {
          onClose();
        }
      }
    } else {
      onClose();
    }
  };

  // Realtime Subscriptions
  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    
    const channel = supabase
      .channel(`task-details-${task.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'task_checklists', 
        filter: `task_id=eq.${task.id}` 
      }, fetchTaskDetails)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'task_comments', 
        filter: `task_id=eq.${task.id}` 
      }, fetchTaskDetails)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'task_attachments', 
        filter: `task_id=eq.${task.id}` 
      }, fetchTaskDetails)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialTask.id, task.id, fetchTaskDetails]);

  // V9.5 - Linkify Rendering
  const renderTextWithLinks = (text: string) => {
    if (!text) return text;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline font-bold"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  if (!isOpen) return null;

  // --- PERMISSIONS (V8.0) ---
  const canEdit = role === 'agency' || (role === 'client' && isFirstColumn && String(task.created_by) === String(currentUser.id));

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistTitle.trim() || !canEdit) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklists`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-test-user": currentUser.id
        },
        body: JSON.stringify({ title: newChecklistTitle, position: (task.checklists?.length || 0) })
      });
      if (res.ok) {
        setNewChecklistTitle("");
        fetchTaskDetails();
      }
    } catch (err) { console.error(err); }
  };

  const toggleChecklistItem = async (itemId: string, isCompleted: boolean) => {
    try {
      await fetch(`/api/tasks/${task.id}/checklists/${itemId}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-test-user": currentUser.id
        },
        body: JSON.stringify({ is_completed: !isCompleted })
      });
      // Optimized: update local state immediately
      setTask(prev => ({
        ...prev,
        checklists: prev.checklists?.map(item => 
          item.id === itemId ? { ...item, is_completed: !isCompleted } : item
        )
      }));
    } catch (err) { console.error(err); }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/checklists/${itemId}`, { 
        method: "DELETE",
        headers: { "x-test-user": currentUser.id }
      });
      if (res.ok) fetchTaskDetails();
    } catch (err) { console.error(err); }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-test-user": currentUser.id
        },
        body: JSON.stringify({ content: newComment, type: activeChat })
      });
      if (res.ok) {
        setNewComment("");
        fetchTaskDetails();
      }
    } catch (err) { console.error(err); }
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-test-user": currentUser.id
        },
        body: JSON.stringify({ name: newAttachmentName, url: newAttachmentUrl })
      });
      if (res.ok) {
        setNewAttachmentName("");
        setNewAttachmentUrl("");
        setIsAddingAttachment(false);
        fetchTaskDetails();
      }
    } catch (err) { console.error(err); }
  };

  const deleteAttachment = async (id: string) => {
    try {
      await fetch(`/api/tasks/${task.id}/attachments/${id}`, { 
        method: "DELETE",
        headers: { "x-test-user": currentUser.id }
      });
      fetchTaskDetails();
    } catch (err) { console.error(err); }
  };

  const handleUpdateTask = async (updates: Partial<Task>) => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-test-user": currentUser.id
        },
        body: JSON.stringify({ id: task.id, ...updates })
      });
      if (res.ok) {
        const updated = await res.json();
        setTask(updated);
        setServerTask(updated);
        onUpdateTask?.(updated);
      }
    } catch (err) { console.error(err); }
    finally { setIsSyncing(false); }
  };

  const handleSaveAll = async (shouldClose = false) => {
    await handleUpdateTask({
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      assignees: tempAssigneeIds as any,
      labels: tempLabelIds as any
    });
    if (shouldClose) onClose();
  };

  const handleDiscard = () => {
    setTask(serverTask);
    setTempAssigneeIds(serverTask.assignees?.map(a => a.user.id) || []);
    setTempLabelIds(serverTask.labels?.map(l => l.label.id) || []);
    setIsEditingTitle(false);
    setIsEditingDesc(false);
  };


  // Checklist Progress
  const completedItems = task.checklists?.filter(i => i.is_completed).length || 0;
  const totalItems = task.checklists?.length || 0;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleConfirmClose} />
      
      <div className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-indigo-100">
        <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
          {isDirty && (
            <button 
              onClick={() => handleSaveAll(true)}
              disabled={isSyncing}
              className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Guardar
            </button>
          )}
          <button onClick={handleConfirmClose} className="p-2 text-gray-400 hover:text-indigo-600 bg-white rounded-full shadow-lg border border-gray-100 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Left Side: Content */}
        <div className="flex-1 overflow-y-auto p-8 md:p-10 no-scrollbar border-r border-gray-50">
          <div className="space-y-8">
            {/* Header */}
            <div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 mb-3 inline-block`}>
                Tarea Detalle {isSyncing && "• Guardando..."}
              </span>
              {/* Row: Checkbox + Title */}
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => onToggleComplete?.(task)}
                  className={`mt-2 min-w-8 min-h-8 w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-200 cursor-pointer shadow-sm ${
                    isLastColumn 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-500/20' 
                      : 'bg-white border-gray-300 hover:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 text-transparent hover:text-emerald-100'
                  }`}
                  title={isLastColumn ? "Marcar como incompleta" : "Marcar como completada"}
                >
                  <CheckSquare size={20} strokeWidth={3} className={isLastColumn ? "text-white" : "opacity-0 hover:opacity-100"} />
                </button>

                <div className="flex-1">
                  {role === 'agency' ? (
                    <div className="group relative">
                      <input 
                        type="text"
                        value={task.title}
                        onChange={(e) => setTask({...task, title: e.target.value})}
                        className={`w-full text-3xl font-black text-gray-800 leading-tight bg-transparent border-none focus:ring-2 focus:ring-indigo-500/10 rounded-xl px-0 hover:bg-slate-50 transition-all font-sans tracking-tighter ${isLastColumn ? 'line-through text-gray-400 opacity-60 decoration-emerald-500/50 decoration-2' : ''}`}
                      />
                    </div>
                  ) : (
                    <h2 className={`text-3xl font-black text-gray-800 leading-tight font-sans tracking-tighter mt-1.5 ${isLastColumn ? 'line-through text-gray-400 opacity-60 decoration-emerald-500/50 decoration-2' : ''}`}>
                      {task.title}
                      {task.creator?.company_name && (
                        <span className="text-indigo-400 opacity-60 ml-2">
                          | {task.creator.company_name}
                        </span>
                      )}
                    </h2>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-medium text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Creado por {task.creator?.first_name || "Agencia"} {task.creator?.company_name && (
                    <span className="opacity-70">({task.creator.company_name})</span>
                  )}
                </div>
                <span>•</span>
                <div>{format(new Date(task.created_at), "dd MMMM yyyy", { locale: es })}</div>
                
                {role === 'agency' && (
                  <div className="flex items-center gap-2">
                    <span>•</span>
                    <input 
                      type="datetime-local"
                      value={task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd'T'HH:mm") : ""}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val && val.endsWith('T00:00')) {
                           val = val.replace('T00:00', 'T10:00');
                        }
                        setTask({ ...task, due_date: val || null });
                      }}
                      className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-indigo-600 focus:ring-0 p-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
            

            {/* Description */}
            {/* V9.5 - Description with Auto-link & Maximized Space */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  Descripción
                </h4>
                {role === 'agency' && (
                  <button 
                    onClick={() => setIsEditingDesc(!isEditingDesc)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      isEditingDesc ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {isEditingDesc ? <><Eye size={12} /> Ver</> : <><Edit2 size={12} /> Editar</>}
                  </button>
                )}
              </div>
              
              {isEditingDesc && role === 'agency' ? (
                <textarea 
                  value={task.description || ""}
                  onChange={(e) => setTask({ ...task, description: e.target.value })}
                  placeholder="Añadir una descripción detallada..."
                  className="w-full text-gray-600 bg-slate-50/50 p-6 rounded-2xl border border-dashed border-gray-200 text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all min-h-[150px] resize-none overflow-y-auto"
                  autoFocus
                />
              ) : (
                <div 
                  onClick={() => role === 'agency' && setIsEditingDesc(true)}
                  className={`text-gray-600 bg-slate-50/50 p-6 rounded-2xl border border-dashed border-gray-200 text-sm leading-relaxed whitespace-pre-wrap break-words min-h-[150px] ${role === 'agency' ? 'cursor-pointer hover:bg-slate-100/50 transition-colors' : ''}`}
                >
                  {task.description ? renderTextWithLinks(task.description) : "Sin descripción proporcionada."}
                </div>
              )}
            </div>

            {/* Etiquetas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <Tag size={16} /> Etiquetas
                </h4>
                {canEdit && (
                  <button 
                    onClick={() => setIsCreatingLabel(!isCreatingLabel)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                  >
                    {isCreatingLabel ? "Cancelar" : "+ Nueva Etiqueta"}
                  </button>
                )}
              </div>

              {isCreatingLabel && canEdit && (
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-gray-100 mb-3">
                  <input 
                    type="color" 
                    value={newLabelColor}
                    onChange={e => setNewLabelColor(e.target.value)}
                    className="w-8 h-8 rounded shrink-0 cursor-pointer border-0 p-0"
                  />
                  <input 
                    type="text"
                    placeholder="Nombre de la etiqueta"
                    value={newLabelName}
                    onChange={e => setNewLabelName(e.target.value)}
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <button
                    disabled={isSubmittingLabel || !newLabelName.trim()}
                    onClick={async () => {
                      if (!newLabelName.trim()) return;
                      setIsSubmittingLabel(true);
                      try {
                        const res = await fetch("/api/labels", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor })
                        });
                        if (res.ok) {
                          const newLabel = await res.json();
                          onLabelCreated?.(newLabel);
                          
                          // Also directly assign it to this task
                          setTempLabelIds(prev => [...prev, newLabel.id]);

                          setNewLabelName("");
                          setIsCreatingLabel(false);
                        }
                      } catch (e) {
                        console.error(e);
                      } finally {
                        setIsSubmittingLabel(false);
                      }
                    }}
                    className="bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isSubmittingLabel ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </div>
              )}

              {availableLabels.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {availableLabels.map(label => {
                    const isSelected = tempLabelIds.includes(label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => {
                          if (!canEdit) return;
                          const currentLabels = tempLabelIds;
                          const newLabels = isSelected
                            ? currentLabels.filter(id => id !== label.id)
                            : [...currentLabels, label.id];
                          setTempLabelIds(newLabels);
                        }}
                        disabled={!canEdit}
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border transition-all ${
                          isSelected
                            ? "shadow-sm scale-105"
                            : "opacity-40 grayscale hover:opacity-100 hover:grayscale-0"
                        } ${!canEdit && !isSelected ? "hidden" : ""}`}
                        style={{ 
                          backgroundColor: isSelected ? `${label.color}20` : "transparent", 
                          color: label.color, 
                          borderColor: isSelected ? label.color : "#e5e7eb",
                          cursor: canEdit ? "pointer" : "default"
                        }}
                      >
                        {label.name}
                      </button>
                    );
                  })}
                  {!canEdit && (!task.labels || task.labels.length === 0) && (
                    <div className="text-xs text-gray-400 italic">No hay etiquetas asignadas.</div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic">No hay etiquetas disponibles.</div>
              )}
            </div>

            {/* Checklist */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  Checklist
                  {totalItems > 0 && <span className="text-[10px] text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{completedItems}/{totalItems}</span>}
                </h4>
              </div>

              {/* Progress Bar */}
              {totalItems > 0 && (
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-500 shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <div className="space-y-2">
                {task.checklists?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 group bg-white hover:bg-slate-50 p-3 rounded-xl border border-gray-100 transition-all">
                    {canEdit ? (
                      <button 
                        onClick={() => toggleChecklistItem(item.id, item.is_completed)}
                        className={`transition-colors ${item.is_completed ? "text-indigo-600" : "text-gray-300 hover:text-indigo-400"}`}
                      >
                        {item.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </button>
                    ) : (
                      <div className={item.is_completed ? "text-indigo-600/50" : "text-gray-200"}>
                        {item.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </div>
                    )}
                    <span className={`flex-1 text-sm font-medium ${item.is_completed ? "text-gray-400 line-through" : "text-gray-700"}`}>
                      {item.title}
                    </span>
                    {canEdit && (
                      <button 
                        onClick={() => handleDeleteChecklistItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-rose-300 hover:text-rose-500 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}

                {canEdit && (
                  <form onSubmit={handleAddChecklistItem} className="flex gap-2 mt-4">
                    <input 
                      type="text"
                      value={newChecklistTitle}
                      onChange={(e) => setNewChecklistTitle(e.target.value)}
                      placeholder="Añadir un paso..."
                      className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    <button type="submit" className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">
                      <Plus size={20} />
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                  <Paperclip size={16} />
                  Adjuntos
                </h4>
                {canEdit && (
                  <button 
                    onClick={() => setIsAddingAttachment(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
                  >
                    Agregar link
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {task.attachments?.map((att) => (
                  <div key={att.id} className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl hover:border-indigo-200 group transition-all">
                    <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <LinkIcon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block text-sm font-bold text-gray-800 hover:text-indigo-600 truncate">
                        {att.name}
                      </a>
                      <span className="text-[10px] text-gray-400 font-medium uppercase">{att.type}</span>
                    </div>
                    {canEdit && (
                      <button onClick={() => deleteAttachment(att.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 transition-all">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isAddingAttachment && (
                <form onSubmit={handleAddAttachment} className="bg-slate-50 p-4 rounded-2xl space-y-3 border border-indigo-100 border-dashed">
                  <input 
                    type="text" 
                    placeholder="Nombre (ej: Carpeta Drive)" 
                    value={newAttachmentName}
                    onChange={(e) => setNewAttachmentName(e.target.value)}
                    className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                    required
                  />
                  <input 
                    type="url" 
                    placeholder="https://..." 
                    value={newAttachmentUrl}
                    onChange={(e) => setNewAttachmentUrl(e.target.value)}
                    className="w-full bg-white border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-medium"
                    required
                  />
                  <div className="flex justify-end gap-2 text-xs">
                    <button type="button" onClick={() => setIsAddingAttachment(false)} className="px-3 py-1.5 font-bold text-gray-400 hover:text-gray-600">Cancelar</button>
                    <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white font-black uppercase rounded-lg">Guardar</button>
                  </div>
                </form>
              )}
            </div>
            {/* V9.4 - Members / Assignees (Agency Only) - Moved to bottom and batch-saved */}
            {role === 'agency' && (
              <div className="pt-8 border-t border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                    Miembros Asignados
                  </h4>
                  {isDirty && JSON.stringify(tempAssigneeIds.sort()) !== JSON.stringify((serverTask.assignees?.map(a => a.user.id) || []).sort()) && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 animate-pulse">Cambios pendientes</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {agencyUsers.map(user => {
                    const isSelected = tempAssigneeIds.includes(user.id);
                    const isActuallyAssigned = task.assignees?.some(a => a.user.id === user.id);
                    
                    return (
                      <button
                        key={user.id}
                        onClick={() => {
                          setTempAssigneeIds(prev => 
                            isSelected ? prev.filter(id => id !== user.id) : [...prev, user.id]
                          );
                        }}
                        className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                          isSelected 
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                            : "bg-white border-gray-100 text-gray-400 hover:border-indigo-200 hover:text-indigo-600"
                        }`}
                        title={user.first_name + " " + user.last_name}
                      >
                        <div className="h-5 w-5 rounded-lg overflow-hidden border border-white/20">
                          {user.profile_pic ? (
                            <img src={user.profile_pic} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className={`h-full w-full flex items-center justify-center text-[8px] font-black ${isSelected ? "text-white" : "text-indigo-600 bg-indigo-50"}`}>
                              {user.first_name[0]}{user.last_name[0]}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tight">{user.first_name}</span>
                        {isSelected && !isActuallyAssigned && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full border border-white animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Dual Chat */}
        <div className="w-full md:w-80 bg-slate-50/50 flex flex-col p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">
              Comunicación
            </h4>
            {isLoading && <Loader2 size={16} className="text-indigo-500 animate-spin" />}
          </div>

          {/* Toggle Channels */}
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-6">
            <button 
              onClick={() => setActiveChat("external")}
              className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeChat === "external" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400"}`}
            >
              Publico
            </button>
            {role === "agency" && (
              <button 
                onClick={() => setActiveChat("internal")}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeChat === "internal" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-gray-400"}`}
              >
                <Lock size={10} />
                Interno
              </button>
            )}
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar min-h-[300px] mb-6 pr-2 py-4">
            {task.comments?.filter(c => c.type === activeChat).map((comment) => {
              const isMe = comment.user_id === currentUser.id;
              
              return (
                <div key={comment.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Avatar bubble */}
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-100 border border-white shadow-sm overflow-hidden mt-auto">
                    {comment.user?.profile_pic ? (
                      <img src={comment.user.profile_pic} alt="" className="object-cover h-full w-full" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] font-black text-indigo-600 bg-indigo-50">
                        {comment.user?.first_name[0]}{comment.user?.last_name[0]}
                      </div>
                    )}
                  </div>

                  <div className={`flex flex-col gap-1 max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                    <div className={`p-3 rounded-2xl text-xs font-medium shadow-sm border ${
                      isMe 
                        ? (activeChat === "internal" 
                          ? "bg-indigo-600 text-white border-indigo-500 rounded-tr-none" 
                          : "bg-indigo-50 border-indigo-100 text-indigo-900 rounded-tr-none")
                        : "bg-white border-gray-100 text-gray-800 rounded-tl-none"
                    }`}>
                      {comment.content}
                    </div>
                    <div className="flex items-center gap-2 px-1 text-[8px] font-black uppercase tracking-widest opacity-40">
                      <span>{comment.user?.first_name}</span>
                      <span>•</span>
                      <span>{format(new Date(comment.created_at), "HH:mm")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!task.comments || task.comments.filter(c => c.type === activeChat).length === 0) && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
                <MessageSquare size={32} className="mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Sin mensajes aún</p>
              </div>
            )}
          </div>

          {/* New Comment Form */}
          <form onSubmit={handleAddComment} className="relative">
            <input 
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={activeChat === "internal" ? "Nota interna..." : "Pregunta o duda..."}
              className="w-full bg-white border-none rounded-2xl px-5 py-4 text-xs pr-12 focus:ring-2 focus:ring-indigo-500 shadow-lg shadow-slate-200 placeholder:opacity-50 font-medium"
            />
            <button 
              type="submit" 
              className={`absolute right-2 top-2 bottom-2 w-10 flex items-center justify-center rounded-xl transition-all ${activeChat === "internal" ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-900 text-white"}`}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
