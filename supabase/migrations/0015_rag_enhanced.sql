-- 0015_rag_enhanced.sql
-- RAG: corpora multi-tenant, búsqueda híbrida (semántica + léxica), bitácora.

create table if not exists rag_corpora (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id),
  code        text not null,                 -- 'normativa_co','manuales_internos','ccu','historico'
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, code)
);

-- Asociación documento ↔ corpus
alter table regulatory_documents
  add column if not exists corpus_id uuid references rag_corpora(id);

-- Campos adicionales en chunks para búsqueda léxica + filtrado
alter table knowledge_base_chunks
  add column if not exists corpus_id uuid references rag_corpora(id),
  add column if not exists section   text,
  add column if not exists lang      text default 'es',
  add column if not exists content_tsv tsvector;

create or replace function trg_kb_tsv()
returns trigger language plpgsql as $$
begin
  new.content_tsv := to_tsvector(coalesce(new.lang,'es')::regconfig, coalesce(new.content,''));
  return new;
end $$;

drop trigger if exists kb_tsv_set on knowledge_base_chunks;
create trigger kb_tsv_set
  before insert or update of content, lang on knowledge_base_chunks
  for each row execute function trg_kb_tsv();

create index if not exists ix_kb_tsv on knowledge_base_chunks using gin (content_tsv);
create index if not exists ix_kb_corpus on knowledge_base_chunks(corpus_id);
create index if not exists ix_kb_trgm on knowledge_base_chunks using gin (content gin_trgm_ops);

-- Bitácora de consultas RAG (para mejora continua)
create table if not exists rag_query_log (
  id            bigserial primary key,
  org_id        uuid references organizations(id),
  user_id       uuid references users_profile(id),
  case_id       uuid references pqrs_cases(id),
  query_text    text not null,
  retrieved_ids bigint[] not null,
  scores        numeric(6,4)[] not null,
  model         text,
  latency_ms    int,
  created_at    timestamptz not null default now()
);

create index if not exists ix_rag_log_org on rag_query_log(org_id, created_at desc);

------------------------------------------------------------
-- Función de búsqueda híbrida (RRF reciprocal rank fusion)
------------------------------------------------------------
create or replace function fn_rag_hybrid_search(
  p_org uuid,
  p_query text,
  p_query_embedding vector(1536),
  p_corpus uuid default null,
  p_top_k int default 8
) returns table (
  id bigint,
  document_id uuid,
  content text,
  section text,
  score numeric,
  semantic_rank int,
  lexical_rank int
) language sql stable as $$
  with semantic as (
    select c.id, c.document_id, c.content, c.section,
           row_number() over (order by c.embedding <=> p_query_embedding) as rnk
    from knowledge_base_chunks c
    where (p_org is null or c.org_id is null or c.org_id = p_org)
      and (p_corpus is null or c.corpus_id = p_corpus)
    order by c.embedding <=> p_query_embedding
    limit p_top_k * 4
  ),
  lexical as (
    select c.id, c.document_id, c.content, c.section,
           row_number() over (order by ts_rank(c.content_tsv, plainto_tsquery('spanish', p_query)) desc) as rnk
    from knowledge_base_chunks c
    where (p_org is null or c.org_id is null or c.org_id = p_org)
      and (p_corpus is null or c.corpus_id = p_corpus)
      and c.content_tsv @@ plainto_tsquery('spanish', p_query)
    order by ts_rank(c.content_tsv, plainto_tsquery('spanish', p_query)) desc
    limit p_top_k * 4
  ),
  fused as (
    select id, document_id, content, section,
           sum(1.0 / (60 + rnk))::numeric as score,
           max(semantic_rank) as semantic_rank,
           max(lexical_rank)  as lexical_rank
    from (
      select id, document_id, content, section, rnk, rnk as semantic_rank, null::int as lexical_rank from semantic
      union all
      select id, document_id, content, section, rnk, null::int as semantic_rank, rnk as lexical_rank from lexical
    ) t
    group by id, document_id, content, section
  )
  select id, document_id, content, section, score, semantic_rank, lexical_rank
  from fused order by score desc limit p_top_k;
$$;

comment on function fn_rag_hybrid_search is
  'Búsqueda híbrida: combina similitud coseno (pgvector) y full-text (tsvector) usando Reciprocal Rank Fusion.';
