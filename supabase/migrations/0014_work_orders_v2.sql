-- 0014_work_orders_v2.sql
-- Geo, checklist, fotos, firma cliente, plantillas OT.

alter table work_orders
  add column if not exists scheduled_at   timestamptz,
  add column if not exists lat            numeric(9,6),
  add column if not exists lng            numeric(9,6),
  add column if not exists address_text   text,
  add column if not exists municipality   text,
  add column if not exists department     text,
  add column if not exists started_at     timestamptz,
  add column if not exists checklist      jsonb default '[]'::jsonb,
  add column if not exists requires_signature boolean not null default true;

create table if not exists work_order_photos (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  org_id        uuid references organizations(id),
  bucket        text not null default 'pqrs-adjuntos',
  storage_path  text not null,
  caption       text,
  taken_at      timestamptz,
  lat           numeric(9,6),
  lng           numeric(9,6),
  uploaded_by   uuid references users_profile(id),
  created_at    timestamptz not null default now()
);

create index if not exists ix_wo_photos on work_order_photos(work_order_id);

create table if not exists work_order_signatures (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references work_orders(id) on delete cascade,
  org_id        uuid references organizations(id),
  signer_name   text not null,
  signer_doc    text,
  signature_url text not null,                  -- imagen firmada en Storage
  signed_at     timestamptz not null default now(),
  ip            inet,
  user_agent    text
);

create unique index if not exists ux_wo_signature on work_order_signatures(work_order_id);

-- Plantillas de checklist por tipo de OT (parametrizable)
create table if not exists work_order_templates (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references organizations(id),
  type         work_order_type not null,
  name         text not null,
  checklist    jsonb not null default '[]'::jsonb,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

insert into work_order_templates(type, name, checklist) values
  ('visita_tecnica','Visita técnica estándar', jsonb_build_array(
     jsonb_build_object('id','llegada','label','Confirmar llegada al sitio','required',true),
     jsonb_build_object('id','identificacion','label','Identificarse y mostrar carné','required',true),
     jsonb_build_object('id','inspeccion','label','Inspección visual del medidor','required',true),
     jsonb_build_object('id','lectura','label','Lectura actual','required',true,'type','number'),
     jsonb_build_object('id','foto_medidor','label','Foto del medidor','required',true,'type','photo'),
     jsonb_build_object('id','foto_entorno','label','Foto del entorno','required',false,'type','photo'),
     jsonb_build_object('id','observaciones','label','Observaciones','required',false,'type','text')
  )),
  ('inspeccion_medidor','Inspección de medidor', jsonb_build_array(
     jsonb_build_object('id','serial','label','Verificar serial del medidor','required',true),
     jsonb_build_object('id','sellos','label','Sellos de seguridad intactos','required',true,'type','boolean'),
     jsonb_build_object('id','prueba_carga','label','Prueba de carga','required',true,'type','number'),
     jsonb_build_object('id','foto_sellos','label','Foto de sellos','required',true,'type','photo'),
     jsonb_build_object('id','dictamen','label','Dictamen técnico','required',true,'type','text')
  )),
  ('suspension','Suspensión de servicio', jsonb_build_array(
     jsonb_build_object('id','aviso_previo','label','Aviso previo entregado','required',true,'type','boolean'),
     jsonb_build_object('id','foto_corte','label','Foto del corte','required',true,'type','photo'),
     jsonb_build_object('id','sellado','label','Sellado','required',true,'type','boolean')
  )),
  ('reconexion','Reconexión de servicio', jsonb_build_array(
     jsonb_build_object('id','pago_verificado','label','Pago verificado','required',true,'type','boolean'),
     jsonb_build_object('id','foto_reconexion','label','Foto de reconexión','required',true,'type','photo'),
     jsonb_build_object('id','prueba_servicio','label','Servicio activo','required',true,'type','boolean')
  )),
  ('revision_lectura','Revisión de lectura', jsonb_build_array(
     jsonb_build_object('id','lectura_actual','label','Lectura actual','required',true,'type','number'),
     jsonb_build_object('id','foto_lectura','label','Foto de la lectura','required',true,'type','photo')
  )),
  ('revision_facturacion','Revisión de facturación', jsonb_build_array(
     jsonb_build_object('id','periodo','label','Periodo revisado','required',true,'type','text'),
     jsonb_build_object('id','consumo','label','Consumo (kWh)','required',true,'type','number'),
     jsonb_build_object('id','hallazgos','label','Hallazgos','required',true,'type','text'),
     jsonb_build_object('id','decision','label','Decisión','required',true,'type','text')
  )),
  ('ajuste_comercial','Ajuste comercial', jsonb_build_array(
     jsonb_build_object('id','valor','label','Valor del ajuste','required',true,'type','number'),
     jsonb_build_object('id','justificacion','label','Justificación','required',true,'type','text')
  )),
  ('analisis_juridico','Análisis jurídico', jsonb_build_array(
     jsonb_build_object('id','base_legal','label','Base legal','required',true,'type','text'),
     jsonb_build_object('id','dictamen','label','Dictamen','required',true,'type','text')
  ))
on conflict do nothing;
