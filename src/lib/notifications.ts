import { Task, User } from "@/types/kanban";

type NotificationContext = {
  notificationType: "ASSIGNED" | "MOVED_OUT_OF_FIRST_STAGE" | "REACHED_LAST_STAGE";
  task: Partial<Task>;
  recipientEmail: string;
  recipientName: string;
  previousColumnId?: string;
  newColumnId?: string;
};

// Configuración opcional
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL;
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kiev-task-manager.vercel.app";
const DISABLE_EMAIL_NOTIFICATIONS = process.env.DISABLE_EMAIL_NOTIFICATIONS === "true" || true; // Default to true as per user request


function getEmailSubjectAndBody(ctx: NotificationContext): { subject: string, html: string } {
  const taskTitle = ctx.task.title || "Sin título";
  const taskLink = `${APP_URL}?userId=${ctx.task.id}`;

  if (ctx.notificationType === "ASSIGNED") {
    return {
      subject: `Nueva Tarea Asignada: ${taskTitle}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4f46e5;">¡Hola ${ctx.recipientName}!</h2>
          <p>Te han asignado una nueva tarea en el tablero.</p>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; font-size: 16px;">${taskTitle}</p>
          </div>
          <a href="${taskLink}" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Ver Tarea</a>
        </div>
      `
    };
  }

  if (ctx.notificationType === "MOVED_OUT_OF_FIRST_STAGE") {
    return {
      subject: `Tu tarea "${taskTitle}" ha comenzado a procesarse`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #4f46e5;">¡Hola ${ctx.recipientName}!</h2>
          <p>Te informamos que tu tarea <strong>"${taskTitle}"</strong> ha salido de la fase inicial y el equipo ha comenzado a trabajar en ella.</p>
          <a href="${taskLink}" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">Ver Progreso</a>
        </div>
      `
    };
  }

  if (ctx.notificationType === "REACHED_LAST_STAGE") {
    return {
      subject: `¡Buenas noticias! Tu tarea "${taskTitle}" está lista / finalizada`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #10b981;">¡Hola ${ctx.recipientName}!</h2>
          <p>Te informamos que el equipo ha movido tu tarea <strong>"${taskTitle}"</strong> a la última etapa del proceso.</p>
          <p>Por favor revisa el tablero para más información.</p>
          <a href="${taskLink}" style="display: inline-block; background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 15px;">Revisar Tarea</a>
        </div>
      `
    };
  }

  return { subject: "Notificación de Tarea", html: "<p>Hay novedades en tu tarea.</p>" };
}

export async function sendTaskNotification(ctx: NotificationContext) {
  if (DISABLE_EMAIL_NOTIFICATIONS) {
    console.log(`[Notifications] Notificación de email omitida (Desactivado por configuración): ${ctx.notificationType}`);
    return;
  }

  if (!ctx.recipientEmail) {
    console.warn("No se pudo enviar notificación: el destinatario no tiene correo electrónico.");
    return;
  }

  const { subject, html } = getEmailSubjectAndBody(ctx);

  // 1. Envío por Resend (Prioridad)
  if (RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to: [ctx.recipientEmail],
          subject: subject,
          html: html
        })
      });
      if (!res.ok) {
        throw new Error(`Error Resend: ${await res.text()}`);
      }
      console.log(`[Resend] Correo enviado a ${ctx.recipientEmail} (${ctx.notificationType})`);
    } catch (err) {
      console.error("[Resend] Fallo al enviar:", err);
    }
  }

  // 2. Envío por Webhook de GHL (Alternativa / Simultáneo)
  if (GHL_WEBHOOK_URL) {
    try {
      const res = await fetch(GHL_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: ctx.recipientEmail,
          name: ctx.recipientName,
          notificationType: ctx.notificationType,
          taskTitle: ctx.task.title,
          taskId: ctx.task.id,
          taskUrl: `${APP_URL}?userId=${ctx.task.id}`
        })
      });
      if (!res.ok) {
        throw new Error(`Error GHL Webhook: ${await res.text()}`);
      }
      console.log(`[Webhook] Notificación disparada a GHL para ${ctx.recipientEmail} (${ctx.notificationType})`);
    } catch (err) {
      console.error("[Webhook] Fallo al disparar:", err);
    }
  }

  // 3. Fallback en desarrollo
  if (!RESEND_API_KEY && !GHL_WEBHOOK_URL) {
    console.log(`\n\n=== Notificación de Tarea Simulada ===`);
    console.log(`Para: ${ctx.recipientName} <${ctx.recipientEmail}>`);
    console.log(`Tipo: ${ctx.notificationType}`);
    console.log(`Asunto: ${subject}`);
    console.log(`======================================\n`);
  }
}

