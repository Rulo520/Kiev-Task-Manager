"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Info, Tag } from "lucide-react";

interface KievModalUIProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  isDanger?: boolean;
  isPrompt?: boolean;
  defaultValue?: string;
  placeholder?: string;
  onConfirm: (val?: any) => void;
  onCancel: () => void;
}

export function KievModalUI({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  isDanger = false,
  isPrompt = false,
  defaultValue = "",
  placeholder = "Escribe aquí...",
  onConfirm,
  onCancel,
}: KievModalUIProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) setInputValue(defaultValue);
  }, [isOpen, defaultValue]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-white rounded-[32px] shadow-2xl border border-white/20 p-8 max-w-md w-full overflow-hidden"
          >
            {/* Background Gradient Detail */}
            <div className={`absolute top-0 left-0 right-0 h-1.5 ${isDanger ? 'bg-rose-500' : 'bg-indigo-600'}`} />
            
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Icon */}
              <div className={`p-4 rounded-3xl ${isDanger ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-600'}`}>
                {isPrompt ? <Tag size={32} strokeWidth={2.5} /> : (isDanger ? <AlertCircle size={32} strokeWidth={2.5} /> : <Info size={32} strokeWidth={2.5} />)}
              </div>

              {/* Text Content */}
              <div className="space-y-2 w-full">
                <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-widest">{title}</h3>
                <p className="text-gray-500 font-medium leading-relaxed">
                  {message}
                </p>
                
                {isPrompt && (
                  <div className="mt-4 w-full">
                    <input 
                      autoFocus
                      type="text"
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 placeholder:text-gray-300"
                      value={inputValue}
                      placeholder={placeholder}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onConfirm(inputValue);
                        if (e.key === "Escape") onCancel();
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                {cancelText && (
                  <button
                    onClick={onCancel}
                    className="flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-400 bg-gray-50 hover:bg-gray-100 transition-all border border-gray-100"
                  >
                    {cancelText}
                  </button>
                )}
                <button
                  onClick={() => onConfirm(isPrompt ? inputValue : true)}
                  disabled={isPrompt && !inputValue.trim()}
                  className={`flex-1 px-6 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isDanger 
                      ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
