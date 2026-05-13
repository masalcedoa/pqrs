-- 0006_tables_ia_audit.sql
-- IA, RAG, notificaciones, auditoría, API keys

-- Documentos normativos cargados
create table if not exists regulatory_documents (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  source       text not null,                -- 'Ley 142/94','CREG 108/97','SSPD','CCU','manual_interno','historico_pqrs'
  doc_type     text,                         -- ley, resolucion, concepto, manual, contrato, jurisprudencia
  issued_date  date,
  storage_path text,
  url          text,
  hash_sha256  text unique,
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Chunks vectorizados para RAG (pgvector)
create table if not exists knowledge_base_chunks (
  id           bigserial primary key,
  document_id  uuid not null references regulatory_documents(id) on delete cascade,
  chunk_index  int not null,
  content      text not null,
  token_count  int,
  embedding    vector(1536),                  -- text-embedding-3-small
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- Interacciones con modelos IA (chat, clasificación, redacción)
create table if not exists ai_interactions (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid references pqrs_cases(id) on delete set null,
  user_id        uuid references users_profile(id),
  purpose        text not null,                -- 'chat_publico','clasificar','redactar','rag_consulta','sugerir_orden'
  model          text not null,
  prompt         text,
  response       text,
  input_tokens   int,
  output_tokens  int,
  latency_ms     int,
  cost_usd       numeric(10,6),
  metadata       jsonb default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

-- Notificaciones multicanal
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid references pqrs_cases(id) on delete set null,
  recipient  text not null,                   -- email, whatsapp:+57..., sms:+57...
  channel    notification_channel not null,
  template   text,
  subject    text,
  body       text,
  status     notification_status not null default 'pendiente',
  provider   text,
  provider_response jsonb,
  attempts   int not null default 0,
  sent_at    timestamptz,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auditoría genérica
create table if not exists audit_log (
  id          bigserial primary key,
  table_name  text not null,
  row_pk      text,
  operation   text not null check (operation in ('INSERT','UPDATE','DELETE')),
  changed_by  uuid,
  ip          inet,
  user_agent  text,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);

-- Tokens API (Power BI, integraciones externas)
create table if not exists api_keys (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  hash_sha256 text unique not null,
  scope       text[] not null default '{readonly}',
  is_active   boolean not null default true,
  expires_at  timestamptz,
  created_by  uuid references users_profile(id),
  last_used   timestamptz,
  created_at  timestamptz not null default now()
);
