-- ============================================================================
--  Module Marketing Email — Schéma PostgreSQL
--  À exécuter : psql "$DATABASE_URL" -f db/schema.sql
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- Utilisateurs
-- Reflète l'utilisateur du CRM existant. `crm_user_id` = identifiant côté CRM.
create table if not exists users (
  id           uuid primary key default uuid_generate_v4(),
  crm_user_id  text unique not null,
  email        text,
  name         text,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------- Boîtes email
-- Une boîte Gmail/Outlook connectée par OAuth2. Tokens chiffrés au repos (AES-256-GCM).
create table if not exists email_accounts (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references users(id) on delete cascade,
  provider           text not null check (provider in ('gmail','outlook')),
  email              text not null,
  display_name       text,
  access_token_enc   text not null,
  refresh_token_enc  text,
  token_expires_at   timestamptz,
  scope              text,
  sync_cursor        text,                 -- Gmail historyId / Graph deltaLink
  daily_send_count   int not null default 0,
  daily_count_date   date,
  status             text not null default 'connected' check (status in ('connected','error','disconnected')),
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, email)
);

-- ----------------------------------------------------------------- Contacts
create table if not exists contacts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id) on delete cascade,
  email       text not null,
  first_name  text,
  last_name   text,
  company     text,
  title       text,
  custom      jsonb not null default '{}'::jsonb,   -- variables de personnalisation
  unsubscribed boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, email)
);

-- ------------------------------------------------------------------- Listes
create table if not exists lists (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create table if not exists list_contacts (
  list_id     uuid not null references lists(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete cascade,
  primary key (list_id, contact_id)
);

-- ----------------------------------------------------------------- Campagnes
create table if not exists campaigns (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references users(id) on delete cascade,
  email_account_id uuid references email_accounts(id) on delete set null,
  name             text not null,
  status           text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  timezone         text not null default 'Europe/Paris',
  daily_limit      int not null default 50,                       -- rate limiting
  send_window      jsonb not null default '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}'::jsonb,
  stop_on_reply    boolean not null default true,
  track_opens      boolean not null default true,
  track_clicks     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------ Séquences (étapes d'emails)
create table if not exists sequences (
  id           uuid primary key default uuid_generate_v4(),
  campaign_id  uuid not null references campaigns(id) on delete cascade,
  step_order   int not null,                 -- 1, 2, 3...
  subject      text not null,
  body_html    text not null,
  delay_days   int not null default 0,       -- délai depuis l'étape précédente
  delay_hours  int not null default 0,
  unique (campaign_id, step_order)
);

-- ------------------------------------- Contacts inscrits dans une campagne
create table if not exists campaign_contacts (
  id            uuid primary key default uuid_generate_v4(),
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  contact_id    uuid not null references contacts(id) on delete cascade,
  status        text not null default 'active'
                check (status in ('active','replied','bounced','unsubscribed','completed','failed')),
  current_step  int not null default 0,       -- dernière étape envoyée
  next_send_at  timestamptz,                  -- prochaine étape due
  thread_id     text,                         -- thread du 1er email (pour relances + détection réponse)
  added_at      timestamptz not null default now(),
  unique (campaign_id, contact_id)
);
create index if not exists idx_cc_due on campaign_contacts (status, next_send_at);

-- --------------------------------------------------------- Emails envoyés
create table if not exists emails_sent (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users(id) on delete cascade,
  campaign_id         uuid references campaigns(id) on delete set null,
  contact_id          uuid references contacts(id) on delete set null,
  sequence_id         uuid references sequences(id) on delete set null,
  email_account_id    uuid references email_accounts(id) on delete set null,
  tracking_id         uuid not null default uuid_generate_v4(),     -- pixel / liens
  provider_message_id text,
  thread_id           text,
  to_email            text not null,
  subject             text,
  body_html           text,
  status              text not null default 'queued'
                      check (status in ('queued','sent','failed','bounced')),
  error               text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_es_tracking on emails_sent (tracking_id);
create index if not exists idx_es_campaign on emails_sent (campaign_id);

-- ------------------------------------- Événements (ouvertures, clics, réponses…)
create table if not exists events (
  id            uuid primary key default uuid_generate_v4(),
  email_sent_id uuid references emails_sent(id) on delete cascade,
  campaign_id   uuid references campaigns(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete cascade,
  type          text not null check (type in ('sent','open','click','reply','bounce','unsubscribe')),
  url           text,        -- pour les clics
  user_agent    text,
  ip            text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_events_campaign on events (campaign_id, type);

-- ------------------------------------- Messagerie (inbox + threads)
create table if not exists messages (
  id                  uuid primary key default uuid_generate_v4(),
  email_account_id    uuid not null references email_accounts(id) on delete cascade,
  thread_id           text not null,
  provider_message_id text not null,
  direction           text not null check (direction in ('inbound','outbound')),
  from_email          text,
  to_email            text,
  subject             text,
  snippet             text,
  body_html           text,
  contact_id          uuid references contacts(id) on delete set null,
  is_read             boolean not null default false,
  has_attachments     boolean not null default false,
  received_at         timestamptz not null default now(),
  unique (email_account_id, provider_message_id)
);
create index if not exists idx_msg_thread on messages (email_account_id, thread_id, received_at);

-- ------------------------------------- Pièces jointes (métadonnées)
create table if not exists attachments (
  id           uuid primary key default uuid_generate_v4(),
  message_id   uuid references messages(id) on delete cascade,
  filename     text,
  mime_type    text,
  size_bytes   int,
  storage_key  text,        -- clé S3/disque
  created_at   timestamptz not null default now()
);
