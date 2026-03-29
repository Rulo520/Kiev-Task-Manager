"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { KievModalUI } from "./KievModalUI";

interface KievConfirmContextType {
  confirm: (message: string, options?: { title?: string; confirmText?: string; cancelText?: string; isDanger?: boolean }) => Promise<boolean>;
  alert: (message: string, options?: { title?: string; buttonText?: string }) => Promise<void>;
  prompt: (message: string, options?: { title?: string; defaultValue?: string; placeholder?: string }) => Promise<string | null>;
}

const KievConfirmContext = createContext<KievConfirmContextType | undefined>(undefined);

export const useKiev = () => {
  const context = useContext(KievConfirmContext);
  if (!context) throw new Error("useKiev must be used within a KievConfirmProvider");
  return context;
};

export function KievConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    isDanger?: boolean;
    isPrompt?: boolean;
    defaultValue?: string;
    placeholder?: string;
    resolve: (val: any) => void;
  } | null>(null);

  const confirm = useCallback((message: string, options: any = {}) => {
    return new Promise<boolean>((resolve) => {
      setConfig({
        title: options.title || "Kiev Platform",
        message,
        confirmText: options.confirmText || "Confirmar",
        cancelText: options.cancelText || "Cancelar",
        isDanger: options.isDanger ?? true,
        isPrompt: false,
        resolve
      });
      setIsOpen(true);
    });
  }, []);

  const alert = useCallback((message: string, options: any = {}) => {
    return new Promise<void>((resolve) => {
      setConfig({
        title: options.title || "Kiev Platform",
        message,
        confirmText: options.buttonText || "Entendido",
        isDanger: false,
        isPrompt: false,
        resolve: () => resolve()
      });
      setIsOpen(true);
    });
  }, []);

  const prompt = useCallback((message: string, options: any = {}) => {
    return new Promise<string | null>((resolve) => {
      setConfig({
        title: options.title || "Kiev Platform",
        message,
        confirmText: "Aceptar",
        cancelText: "Cancelar",
        isDanger: false,
        isPrompt: true,
        defaultValue: options.defaultValue || "",
        placeholder: options.placeholder || "Escribe aquí...",
        resolve
      });
      setIsOpen(true);
    });
  }, []);

  const handleClose = (result: any) => {
    setIsOpen(false);
    config?.resolve(result);
  };

  return (
    <KievConfirmContext.Provider value={{ confirm, alert, prompt }}>
      {children}
      {config && (
        <KievModalUI 
          isOpen={isOpen}
          title={config.title}
          message={config.message}
          confirmText={config.confirmText}
          cancelText={config.cancelText}
          isDanger={config.isDanger}
          isPrompt={config.isPrompt}
          defaultValue={config.defaultValue}
          placeholder={config.placeholder}
          onConfirm={(val: any) => handleClose(val ?? true)}
          onCancel={() => handleClose(config.isPrompt ? null : false)}
        />
      )}
    </KievConfirmContext.Provider>
  );
}
