"use client";

import { useState, useEffect } from "react";
import { Lock, ArrowRight, Loader2, AlertCircle, RefreshCw, ExternalLink } from "lucide-react";

interface GatekeeperProps {
  debug?: boolean;
  isIframe?: boolean;
}

export function Gatekeeper({ debug, isIframe }: GatekeeperProps) {
  const [isDetecting, setIsDetecting] = useState(true);
  const [isDenied, setIsDenied] = useState(false);
  const [showHardRefresh, setShowHardRefresh] = useState(false);

  useEffect(() => {
    // V7.1 UX Patch: If we detect we are likely NOT in an iFrame, we show the message faster
    const inIframe = window.self !== window.top;
    
    const timer = setTimeout(() => {
      if (isDetecting) {
        setIsDetecting(false);
        setIsDenied(true);
      }
    }, 4000); // 4 Seconds to allow SDK to breathe

    const refreshTimer = setTimeout(() => {
      setShowHardRefresh(true);
    }, 8000);

    // Standard Handshake via postMessage
    if (typeof window !== "undefined") {
      const handleHandshake = (event: MessageEvent) => {
        if (event.data?.type === "ghl-user-info" && event.data?.id) {
          const gId = event.data.id;
          window.location.href = `?user_id=${gId}${debug ? "&debug=true" : ""}`;
        }
      };
      
      window.addEventListener("message", handleHandshake);
      return () => {
        window.removeEventListener("message", handleHandshake);
        clearTimeout(timer);
        clearTimeout(refreshTimer);
      };
    }

    return () => {
      clearTimeout(timer);
      clearTimeout(refreshTimer);
    };
  }, [debug, isDetecting]);

  const handleHardRefresh = () => {
    // Buster for Cache
    window.location.href = window.location.pathname + "?t=" + new Date().getTime() + (debug ? "&debug=true" : "");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6 relative overflow-hidden font-sans">
      {/* Platform SDK Loader */}
      <script src="https://widgets.leadconnectorhq.com/loader.js" async />

      <div className="w-full max-w-lg z-10">
        <div className="bg-white rounded-[40px] shadow-2xl shadow-indigo-100 border border-white p-10 flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 mb-8 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            <Lock size={40} />
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2 uppercase">
              {isDetecting ? "Detectando" : "Acceso"} <span className="text-indigo-600 font-black">{isDetecting ? "Plataforma..." : "Denegado"}</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] opacity-60">
              Kiev Intelligence Protocol • V7.2
            </p>
          </div>

          {isDetecting && (
            <div className="flex flex-col items-center gap-6 py-10 w-full animate-pulse">
              <Loader2 size={48} className="text-indigo-600 animate-spin" />
              <div className="space-y-2 text-center">
                <p className="text-sm font-black text-slate-600 tracking-tight">Verificando sesión en Kiev Platform...</p>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Esto puede tardar unos segundos</p>
              </div>
            </div>
          )}

          {!isDetecting && isDenied && (
            <div className="w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
              <div className="text-center p-8 bg-slate-50 rounded-[40px] border border-slate-100 w-full shadow-inner">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-6 mx-auto">
                  <AlertCircle size={32} />
                </div>
                <p className="text-lg font-black text-gray-900 leading-tight mb-2 uppercase italic tracking-tighter">
                  Identidad <span className="text-rose-600">No Verificada</span>
                </p>
                
                <div className="mt-6 space-y-4 px-2">
                   {!isIframe && (
                     <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-left">
                       <p className="text-[11px] font-black text-amber-900 uppercase tracking-widest mb-1 flex items-center gap-2">
                         <RefreshCw size={12} strokeWidth={3} /> Acción Requerida
                       </p>
                       <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                         Para usar esta ventana independiente, vuelve a **Kiev Platform (GHL)** y haz clic en el botón <span className="font-bold text-amber-900 uppercase">"Abrir en Nueva Pestaña"</span> dentro del tablero. Esto sincronizará tu acceso.
                       </p>
                     </div>
                   )}
                   
                   <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-left">
                     <p className="text-[11px] font-black text-indigo-900 uppercase tracking-widest mb-1 flex items-center gap-2">
                       <ExternalLink size={12} strokeWidth={3} /> Tip de Privacidad
                     </p>
                     <p className="text-[11px] text-indigo-700 font-medium leading-relaxed">
                       Los navegadores modernos bloquean sesiones automáticas en iFrames por seguridad. La sincronización manual es necesaria la primera vez.
                     </p>
                   </div>
                </div>
              </div>

              <div className="flex flex-col w-full gap-3 max-w-xs">
                <button 
                  onClick={() => window.location.reload()}
                  className="group w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95"
                >
                  Re-intentar Conexión
                  <ArrowRight size={18} />
                </button>
                
                <button 
                  onClick={handleHardRefresh}
                  className="group w-full bg-white border border-slate-200 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                  Limpiar Cache
                </button>
              </div>

              <div className="flex flex-col items-center gap-1 opacity-30 mt-4">
                <p className="text-[8px] text-gray-400 font-black uppercase tracking-[0.2em]">
                  Kiev Safety Protocol V7.2
                </p>
                <p className="text-[7px] text-gray-300 font-bold uppercase">
                  Cross-Domain Sandbox Bridge
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
