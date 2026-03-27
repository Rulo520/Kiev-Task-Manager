"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, MessageSquare, UserPlus, ArrowRightLeft, PlusCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  task_id: string;
}

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          playNotificationSound();

          // V13.5 - Proactive Sync Fallback
          if (newNotif.task_id) {
            window.dispatchEvent(new CustomEvent('sync-task', { detail: { taskId: newNotif.task_id } }));
          }
        }

      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updatedNotif = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      // V19.1 - Handle audio with better error capture
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn("[NotificationBell] Audio blocked by browser policy. Interaction required.", e);
        });
      }
    }
  };

  // V19.1 - Audio Unlocker (Unlocks audio on first user click anywhere in the bell or board)
  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current) {
        audioRef.current.play()
          .then(() => {
            audioRef.current!.pause();
            audioRef.current!.currentTime = 0;
            window.removeEventListener('click', unlockAudio);
            console.log("[NotificationBell] Audio context unlocked");
          })
          .catch(() => {
            // Still blocked, keep listener
          });
      }
    };
    window.addEventListener('click', unlockAudio);
    return () => window.removeEventListener('click', unlockAudio);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", { method: "PUT" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "ASSIGNED":
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case "COLUMN_CHANGE":
        return <ArrowRightLeft className="w-4 h-4 text-amber-500" />;
      case "COMMENT":
        return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      case "TASK_CREATED":
        return <PlusCircle className="w-4 h-4 text-purple-500" />;
      case "TASK_UPDATED":
        return <Check className="w-4 h-4 text-sky-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id);
    if (n.task_id) {
      window.dispatchEvent(new CustomEvent("open-task-detail", { detail: { taskId: n.task_id } }));
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <audio 
        ref={audioRef} 
        src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" 
        preload="auto" 
      />
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-semibold text-slate-800 text-sm">Actividad Reciente</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] font-medium text-blue-600 hover:text-blue-700 uppercase tracking-wider"
                >
                  Marcar todo como leído
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No hay notificaciones</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 border-b border-slate-50 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!n.is_read ? 'bg-blue-50/30' : ''}`}
                  >

                    <div className="mt-1 shrink-0">{getIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 mb-0.5">{n.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-slate-400 mt-2">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
               <button className="text-[11px] font-medium text-slate-500 hover:text-slate-700">
                 Ver todo el historial
               </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
