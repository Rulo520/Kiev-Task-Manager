"use client";

import { useState, useEffect } from "react";
import { Lock, User, ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface GatekeeperProps {
  debug?: boolean;
  isIframe?: boolean;
}

export function Gatekeeper({ debug, isIframe }: GatekeeperProps) {
  const [email, setEmail] = useState("");
  const [isDetecting, setIsDetecting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 5.2 Intelligent GHL Probe
  useEffect(() => {
    const timer = setTimeout(() => {
      // If we don't find identity in 2 seconds, we show the fallback form
      setIsDetecting(false);
    }, 2000);

    // Try to detect GHL Native Identity (Marketplace/Custom App SDK)
    if (typeof window !== "undefined") {
      // Standard GHL handshake via postMessage if SDK is loaded
      window.addEventListener("message", (event) => {
        if (event.data?.type === "ghl-user-info" && event.data?.id) {
          window.location.href = `?user_id=${event.data.id}${debug ? "&debug=true" : ""}`;
        }
      });
    }

    return () => clearTimeout(timer);
  }, [debug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Search by email only (User hates passwords)
      const res = await fetch(`/api/ghl/users?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "No tienes acceso autorizado. Contacta al administrador.");
      }
      
      const userData = await res.json();
      if (!userData || userData.length === 0) {
        throw new Error("Usuario no encontrado en la cuenta de Kiev.");
      }

      // 5.1 Persistence: Set Cookie for future sessions (Required for iFrames)
      document.cookie = `kiev_user_id=${userData[0].id}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=none; secure`;

      // Success! Update URL internally
      window.location.href = `?user_id=${userData[0].id}${debug ? "&debug=true" : ""}`;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 -left-20 w-80 h-80 bg-indigo-200 rounded-full blur-[120px] opacity-40 animate-pulse" />
      <div className="absolute bottom-0 -right-20 w-80 h-80 bg-purple-200 rounded-full blur-[120px] opacity-40 animate-pulse" />

      {/* GHL SDK Loader */}
      <script src="https://widgets.leadconnectorhq.com/loader.js" async />

      <div className="w-full max-w-md z-10">
        <div className="bg-white rounded-[40px] shadow-2xl shadow-indigo-100 border border-white p-10 flex flex-col items-center">
          {/* Logo/Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 mb-8 transform -rotate-6">
            <Lock size={40} className="rotate-6" />
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
              {isDetecting ? "Detectando" : "Identidad"} <span className="text-indigo-600 font-black">{isDetecting ? "GHL..." : "Requerida"}</span>
            </h1>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              Kiev Intelligence Protocol
            </p>
          </div>

          {isDetecting && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={40} className="text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-gray-500 animate-pulse">Consultando sesión de HighLevel...</p>
            </div>
          )}

          {!isDetecting && (
            <>
              {isIframe && (
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 flex gap-3 mb-6">
              <div className="text-amber-500 shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="text-[11px] leading-relaxed text-amber-800">
                <p className="font-bold mb-1">💡 Tip para Usuarios GHL</p>
                <p className="opacity-80">Si estás en el iFrame de GHL y ves esta pantalla, asegúrate de activar la opción <span className="font-bold">"Pass contact/user info as query params"</span> en la configuración del link de GHL para entrar automáticamente.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50/50 border border-red-200/50 rounded-2xl p-4 flex gap-3 animate-shake mb-6 text-xs font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                  Confirmar Email de Sesión
                </label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300">
                    <User size={18} />
                  </div>
                  <input 
                    type="email" 
                    placeholder="ejemplo@ghl.com"
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-gray-900 placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200 hover:shadow-indigo-100 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Vincular Perfil GHL
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-[10px] text-gray-400 font-bold uppercase tracking-tighter text-center">
            Este tablero solo es accesible mediante una sesión activa de GHL.<br/>
            Identifícate una vez para vincular tu acceso de forma permanente.
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
