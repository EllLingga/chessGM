-- Jalankan di Supabase > SQL Editor
create extension if not exists pgcrypto;

create table if not exists ai_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  provider text not null,
  model text not null,
  api_key_enc text,
  key_hint text,
  base_url text,
  temperature real,
  max_tokens int not null default 1024,
  thinking_budget int,
  system_prompt text,
  timeout_s int not null default 60,
  max_retries int not null default 3,
  created_at timestamptz default now()
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'ai_vs_ai',
  white_name text not null,
  black_name text not null,
  white_model text,
  black_model text,
  result text not null,
  termination text,
  pgn text not null,
  moves jsonb not null,
  opening text,
  eco text,
  num_moves int,
  duration_ms int,
  accuracy_white real,
  accuracy_black real,
  analysis jsonb,
  created_at timestamptz default now()
);

-- RLS aktif tanpa policy: hanya service_role (server) yang bisa akses.
alter table ai_profiles enable row level security;
alter table games enable row level security;
