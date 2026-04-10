-- Run once on your PostgreSQL database (Neon, Supabase, Vercel Postgres, self-hosted, etc.).
-- Structure côté app : voir aussi prisma/schema.prisma (Prisma = source pour le code Node).
-- Requires gen_random_uuid() (PostgreSQL 13+) or replace with uuid_generate_v4() + extension "uuid-ossp".

CREATE TABLE IF NOT EXISTS suspect_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pseudo TEXT,
  kd NUMERIC(8, 3) NOT NULL,
  winrate NUMERIC(6, 2),
  ranked_matches INTEGER NOT NULL,
  account_level INTEGER NOT NULL,
  rank_key TEXT,
  seasons_played INTEGER[] NOT NULL,
  verdict TEXT NOT NULL,
  verdict_label TEXT NOT NULL,
  cheat_score NUMERIC(6, 2) NOT NULL,
  smurf_score NUMERIC(6, 2) NOT NULL,
  reasons_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS suspect_submissions_created_at_idx
  ON suspect_submissions (created_at DESC);
