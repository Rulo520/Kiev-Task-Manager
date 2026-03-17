"use client";

import { useState, useEffect } from "react";
import { Lock, ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface GatekeeperProps {
  debug?: boolean;
  isIframe?: boolean;
}

export function Gatekeeper({ debug, isIframe }: GatekeeperProps) {
  const [isDetecting, setIsDetecting] = useState(true);
  const [isDenied, setIsDenied] = useState(false);

  // 5.5 Strict Enforcement & Branding: Kiev Platform Probe
  useEffect(() => {
    const timer = setTimeout(() => {
      // If no valid identity found in 2.5 seconds, we show the blocked screen
      if (isDetecting) {
        setIsDetecting(false);
        setIsDenied(true);
      }
    }, 2500);

    // Standard Handshake via postMessage
    if (typeof window !== "undefined") {
      const handleHandshake = (event: MessageEvent) => {
        // We still check for "ghl-user-info" as it is the technical protocol
        if (event.data?.type === "ghl-user-info" && event.data?.id) {
          window.location.href = `?user_id=${event.data.id}${debug ? "&debug=true" : ""}`;
        }
      };
      
      window.addEventListener("message", handleHandshake);
      return () => {
        window.removeEventListener("message", handleHandshake);
        clearTimeout(timer);
      };
    }

    return () => clearTimeout(timer);
  }, [debug, isDetecting]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6 relative overflow-hidden font-sans">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 w-80 h-80 bg-indigo-200 rounded-full blur-[120px] opacity-40 animate-pulse" />
      <div className="absolute bottom-0 -right-20 w-80 h-80 bg-purple-200 rounded-full blur-[120px] opacity-40 animate-pulse" />

      {/* Platform SDK Loader */}
      <script src="https://widgets.leadconnectorhq.com/loader.js" async />

      <div className="w-full max-w-lg z-10">
        <div className="bg-white rounded-[40px] shadow-2xl shadow-indigo-100 border border-white p-10 flex flex-col items-center">
          {/* Logo/Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 mb-8 transform -rotate-6">
            <Lock size={40} className="rotate-6" />
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2 uppercase">
              {isDetecting ? "Detectando" : "Acceso"} <span className="text-indigo-600 font-black">{isDetecting ? "Plataforma..." : "Denegado"}</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
              Kiev Intelligence Protocol • V5.5
            </p>
          </div>

          {isDetecting && (
            <div className="flex flex-col items-center gap-6 py-10">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-100 rounded-full blur-xl animate-pulse" />
                <Loader2 size={48} className="text-indigo-600 animate-spin relative" />
              </div>
              <p className="text-sm font-black text-slate-500 animate-pulse tracking-tight">Verificando sesión en Kiev Platform...</p>
            </div>
          )}

          {!isDetecting && isDenied && (
            <div className="w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
              <div className="text-center p-8 bg-slate-50/50 rounded-[40px] border border-slate-100 w-full">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mb-6 mx-auto">
                  <AlertCircle size={32} />
                </div>
                <p className="text-lg font-black text-gray-900 leading-tight mb-2">
                  Este tablero es exclusivo del equipo de trabajo de <span className="text-indigo-600 italic">Kiev Agency</span>
                </p>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest opacity-60">
                  Identidad no reconocida
                </p>
              </div>

              <button 
                onClick={() => window.location.reload()}
                className="group w-full max-w-xs bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-xl shadow-slate-200 hover:shadow-indigo-100"
              >
                Re-intentar Conexión
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mt-2">
                Identidad strictly enforced via Kiev Platform
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
