-- 0018_documental.sql
-- Versionamiento documental, OCR jobs, PDFs generados, firma electrónica.

create table if not exists document_versions (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id),
  case_id      uuid references pqrs_cases(id) on delete cascade,
  attachment_id uuid references pqrs_attachments(id) on delete set null,
  version      int not null,
  file_name    text not null,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  hash_sha256  text,
  ocr_text     text,
  classification text,                          -- 'factura','contrato','foto_medidor','soporte','otro'
  created_by   uuid references users_profile(id),
  created_at   timestamptz not null default now()
);

create index if not exists ix_docs_case on document_versions(case_id, version desc);

-- Trabajos OCR
create table if not exists ocr_jobs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id),
  document_id  uuid references document_versions(id) on delete cascade,
  status       text not null default 'pendiente',  -- pendiente|procesando|completado|fallido
  provider     text,
  result_text  text,
  error        text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

-- PDFs generados (respuestas, actos administrativos, OT, etc.)
create table if not exists generated_pdfs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organizations(id),
  case_id       uuid references pqrs_cases(id),
  work_order_id uuid references work_orders(id),
  kind          text not null,                  -- 'respuesta','acto_administrativo','acta_visita'
  template_code text,
  storage_path  text not null,
  hash_sha256   text,
  signed_at     timestamptz,
  signer_id     uuid references users_profile(id),
  signature_kind text,                          -- 'electronica_simple','firma_digital_certificada'
  created_at    timestamptz not null default now()
);

create index if not exists ix_pdfs_case on generated_pdfs(case_id);
