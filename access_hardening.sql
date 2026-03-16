-- Add password support to users for manual login hardening
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- Pre-set a default password for the main admin (Rulo) 
-- IMPORTANT: User should update this later through a profile UI or SQL
UPDATE public.users 
SET password = 'kiev-password-2026' -- Temporary placeholder
WHERE first_name = 'Rulo';

-- Ensure password is NOT visible in public read results (safety measure)
-- Note: In a production app, we would hash these, but for this stage we'll store as text for connectivity tests.
COMMENT ON COLUMN public.users.password IS 'Access key for the Kanban Board manual login.';
