-- Enable full replication identities for Realtime
-- This ensures that Supabase sends the WHOLE row on updates,
-- making it much easier for the frontend to sync.
ALTER TABLE public.orders REPLICA IDENTITY FULL;
