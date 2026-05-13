-- 0001_extensions.sql
-- Extensiones necesarias en Supabase

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";
create extension if not exists "vector";       -- pgvector para RAG
-- pg_cron lo administra Supabase desde el dashboard; se referencia en docs/03-ROADMAP.md
