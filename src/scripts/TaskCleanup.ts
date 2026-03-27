import { getAdminClient } from "../lib/supabase/admin";

async function cleanupTaskTitles() {
  const supabase = getAdminClient();
  console.log("--- INICIANDO LIMPIEZA DE TÍTULOS ---");

  // Fetch all tasks with '|' in title
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, title")
    .filter("title", "ilike", "%|%");

  if (error) {
    console.error("Error fetching tasks:", error);
    return;
  }

  if (!tasks || tasks.length === 0) {
    console.log("No se encontraron tareas con sufijos '|'.");
    return;
  }

  console.log(`Encontradas ${tasks.length} tareas para procesar.`);

  for (const task of tasks) {
    // Split by '|' and take the first part, trimming whitespace
    const newTitle = task.title.split("|")[0].trim();
    
    if (newTitle !== task.title) {
      console.log(`Actualizando: "${task.title}" -> "${newTitle}"`);
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ title: newTitle })
        .eq("id", task.id);
      
      if (updateError) {
        console.error(`Error actualizando tarea ${task.id}:`, updateError);
      }
    }
  }

  console.log("--- LIMPIEZA COMPLETADA ---");
}

cleanupTaskTitles().catch(console.error);
