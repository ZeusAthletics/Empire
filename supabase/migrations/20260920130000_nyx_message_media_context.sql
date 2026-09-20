-- Nyx internal note per outbound image/video (for chat + outreach continuity).

alter table public.nyx_messages
  add column if not exists media_context text;

notify pgrst, 'reload schema';
