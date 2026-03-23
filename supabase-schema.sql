-- Initial Database Schema for GHL Kanban Board

-- Enable UUID extension globally (if not active)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE (Synced from GHL payload/auth)
-- Instead of password auth, we use the GHL user info for authorization mapping
CREATE TABLE public.users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ghl_user_id VARCHAR(255) UNIQUE NOT NULL, -- GHL identifier
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('agency', 'client')),
  location_id VARCHAR(255), -- GHL Location ID scoping
  profile_pic VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. COLUMNS TABLE
CREATE TABLE IF NOT EXISTS public.columns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_visible_to_client BOOLEAN DEFAULT true,
  location_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Default columns might be: Todo, In Progress, Review, Done (can be inserted later)

-- 3. TASKS TABLE (aka "Requerimientos")
CREATE TABLE public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  column_id UUID REFERENCES public.columns(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  location_id VARCHAR(255), -- GHL Location ID for filtering
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.5 LABELS TABLE
CREATE TABLE public.labels (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) NOT NULL, -- hex or tailwind class
  location_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.6 TASK LABELS (Many-to-Many)
CREATE TABLE public.task_labels (
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id UUID REFERENCES public.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);

-- 3.7 TASK CHECKLISTS
CREATE TABLE public.task_checklists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.8 TASK ATTACHMENTS
CREATE TABLE public.task_attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  url TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'link', -- link, file, drive, etc
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.9 TASK COMMENTS (Dual Channel)
CREATE TABLE public.task_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('internal', 'external')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TASK ASSIGNEES (Many-to-Many Relationship for multiple assignees)
CREATE TABLE public.task_assignees (
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

-- ROW LEVEL SECURITY (RLS) POLICIES --
-- These ensure basic data isolation rules are enforced at the DB level, though Next.js API can also act as a gatekeeper.

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Note: Policies are enforced via API (Service Role) for initial complexity.
-- However, we grant public READ access for REALTIME events to work.
DROP POLICY IF EXISTS "Public Read Access" ON tasks;
CREATE POLICY "Public Read Access" ON tasks FOR SELECT TO public USING (true);

-- Ensure Realtime is optimized
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE tasks, columns, labels, task_labels, task_checklists, task_attachments, task_comments;
