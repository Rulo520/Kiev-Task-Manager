"use client";

import { useState } from "react";
import { Lock, User, ArrowRight, Loader2, AlertCircle } from "lucide-react";

interface GatekeeperProps {
  onLogin: (email: string) => void;
}

export function Gatekeeper({ onLogin }: GatekeeperProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // For this implementation, we simulate a login by checking if the user exists
      // In a production app, this would be a real OAuth or Password flow
      const res = await fetch(`/api/ghl/users?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        throw new Error("No tienes acceso autorizado a este tablero. Contacta al administrador.");
      }
      
      const userData = await res.json();
      if (!userData || userData.length === 0) {
        throw new Error("Usuario no encontrado en la cuenta de Kiev.");
      }

      // Success! Pass the user ID back to parent to reload with session
      onLogin(userData[0].id);
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

      <div className="w-full max-w-md z-10">
        <div className="bg-white rounded-[40px] shadow-2xl shadow-indigo-100 border border-white p-10 flex flex-col items-center">
          {/* Logo/Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 mb-8 transform -rotate-6">
            <Lock size={40} className="rotate-6" />
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
              Acceso <span className="text-indigo-600">Restringido</span>
            </h1>
            <p className="text-sm font-medium text-gray-400 uppercase tracking-widest">
              GHL Kiev Pro Management
            </p>
          </div>

          {error && (
            <div className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 text-rose-600 text-xs font-bold mb-8 animate-in shake duration-300">
              <AlertCircle size={16} className="shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">
                Email de GHL
              </label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300">
                  <User size={18} />
                </div>
                <input 
                  type="email" 
                  autoFocus
                  placeholder="ejemplo@ghl.com"
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-6 text-sm font-bold text-gray-900 placeholder:text-gray-300 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
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
                  Entrar al Tablero
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-[10px] text-gray-400 font-bold uppercase tracking-tighter text-center">
            Este tablero requiere permisos de cuenta principal.<br/>
            Si no tienes acceso, consulta con el Administrador de Kiev.
          </p>
        </div>
      </div>
    </div>
  );
}
