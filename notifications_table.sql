-- 5. NOTIFICATIONS TABLE
-- Stores in-app alerts for users.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Recipient (Who sees the bell)
  actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Actor (Who triggered the event)
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE, -- Relevant task
  type VARCHAR(50) NOT NULL, -- e.g. 'ASSIGNED', 'COLUMN_CHANGE', 'COMMENT', 'CHECKLIST'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Note: In this project, we rely on API logic for security, but allow public read for Realtime to work easily
DROP POLICY IF EXISTS "Public Read Access" ON public.notifications;
CREATE POLICY "Public Read Access" ON public.notifications FOR SELECT TO public USING (true);

-- Ensure Realtime is optimized for the new table
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add to Realtime Publication
-- Note: Replace 'supabase_realtime' with your actual publication name if different.
-- Using DROP/CREATE for safety in development.
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE 
  tasks, 
  columns, 
  labels, 
  task_labels, 
  task_checklists, 
  task_attachments, 
  task_comments,
  notifications;
