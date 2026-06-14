// ---------------------------------------------------------------------------
//  Configuration Supabase (synchro temps réel optionnelle).
//  Laisser vide = l'app fonctionne en local (par navigateur), comme avant.
//  Renseigner après avoir créé le projet (voir supabase/SETUP.md).
//  La clé anon est PUBLIQUE (protégée par RLS) : elle peut figurer ici.
// ---------------------------------------------------------------------------
export const SUPABASE_URL = 'https://yblmhwdavbgtjtyfsuyo.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlibG1od2RhdmJndGp0eWZzdXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzODQ1MzQsImV4cCI6MjA5Njk2MDUzNH0._7-3ksaUdKltszwKFzXJalXIT1N-sa7AzXoEg_XBFlE'

export const isSupabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY)
