-- 0007_indexes.sql
-- Índices para performance y búsqueda

-- pqrs_cases
create index if not exists ix_cases_status         on pqrs_cases (status);
create index if not exists ix_cases_due_at         on pqrs_cases (due_at);
create index if not exists ix_cases_received_at    on pqrs_cases (received_at desc);
create index if not exists ix_cases_customer       on pqrs_cases (customer_id);
create index if not exists ix_cases_account        on pqrs_cases (service_account_id);
create index if not exists ix_cases_assigned_to    on pqrs_cases (assigned_to);
create index if not exists ix_cases_unit           on pqrs_cases (assigned_unit_id);
create index if not exists ix_cases_category       on pqrs_cases (category);
create index if not exists ix_cases_type           on pqrs_cases (type);
create index if not exists ix_cases_parent         on pqrs_cases (parent_case_id);
create index if not exists ix_cases_search_tsv     on pqrs_cases using gin (search_tsv);

-- pqrs_messages
create index if not exists ix_messages_case        on pqrs_messages (case_id, created_at);
create index if not exists ix_messages_author      on pqrs_messages (author_id);

-- pqrs_attachments
create index if not exists ix_attachments_case     on pqrs_attachments (case_id);

-- pqrs_status_history
create index if not exists ix_status_hist_case     on pqrs_status_history (case_id, created_at);

-- pqrs_tasks
create index if not exists ix_tasks_case           on pqrs_tasks (case_id);
create index if not exists ix_tasks_assignee       on pqrs_tasks (assigned_to);

-- work_orders
create index if not exists ix_orders_case          on work_orders (case_id);
create index if not exists ix_orders_status        on work_orders (status);
create index if not exists ix_orders_assigned_to   on work_orders (assigned_to);
create index if not exists ix_orders_type          on work_orders (type);

-- notifications
create index if not exists ix_notifications_case   on notifications (case_id);
create index if not exists ix_notifications_status on notifications (status);

-- ai_interactions
create index if not exists ix_ai_case              on ai_interactions (case_id);
create index if not exists ix_ai_user              on ai_interactions (user_id);
create index if not exists ix_ai_purpose           on ai_interactions (purpose, created_at);

-- audit_log
create index if not exists ix_audit_table_pk       on audit_log (table_name, row_pk);
create index if not exists ix_audit_created_at     on audit_log (created_at desc);

-- knowledge_base_chunks (RAG)
create index if not exists ix_kb_doc               on knowledge_base_chunks (document_id);
create index if not exists ix_kb_embedding         on knowledge_base_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- Para datasets grandes preferir HNSW:
-- create index ix_kb_embedding_hnsw on knowledge_base_chunks using hnsw (embedding vector_cosine_ops);

-- customers / service_accounts
create index if not exists ix_customers_doc        on customers (document_type, document_id);
create index if not exists ix_accounts_customer    on service_accounts (customer_id);
create index if not exists ix_accounts_muni        on service_accounts (municipality);
