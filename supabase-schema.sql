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
  profile_pic VARCHAR(1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. COLUMNS TABLE
CREATE TABLE public.columns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default columns might be: Todo, In Progress, Review, Done (can be inserted later)

-- 3. TASKS TABLE (aka "Requerimientos")
CREATE TABLE public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  column_id UUID REFERENCES public.columns(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- the client or agency member who created it
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

-- Note: Actual RLS policies depend on Supabase auth JWTs natively, but since we are relying on GHL Auth + custom backend tokens, we will primarily enforce access controls in the Next.js API Routes rather than relying purely on Supabase RLS.
-- Therefore, we can either create a service role API configuration or implement custom JWT validation in Supabase. For simplicity, we create open policies if using a secure Serverless API wrapper.
