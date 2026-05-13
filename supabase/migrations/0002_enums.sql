-- 0002_enums.sql
-- Tipos enumerados del dominio

create type user_role as enum (
  'ciudadano','agente','analista','supervisor',
  'juridico','tecnico','admin','auditor'
);

create type pqrs_type as enum (
  'peticion','queja','reclamo',
  'recurso_reposicion','recurso_apelacion',
  'denuncia','solicitud_tecnica'
);

create type pqrs_channel as enum (
  'portal','chat_ia','whatsapp','email',
  'telefono','presencial','oficio','api'
);

create type pqrs_priority as enum ('baja','media','alta','critica');

create type pqrs_status as enum (
  'radicado','en_validacion','clasificado','asignado',
  'en_analisis','pendiente_informacion','orden_generada',
  'en_visita_tecnica','en_revision_comercial','en_revision_juridica',
  'respuesta_proyectada','resuelto','notificado',
  'en_recurso_reposicion','en_apelacion','escalado_sspd',
  'cerrado','vencido'
);

create type pqrs_category as enum (
  'facturacion','lectura','consumo_elevado','suspension',
  'reconexion','medidor','calidad_servicio','dano_electrico',
  'atencion_usuario','cobros','otro'
);

create type work_order_type as enum (
  'revision_facturacion','visita_tecnica','inspeccion_medidor',
  'suspension','reconexion','revision_lectura',
  'ajuste_comercial','analisis_juridico'
);

create type work_order_status as enum (
  'creada','asignada','en_ejecucion','en_espera',
  'completada','cancelada','rechazada'
);

create type notification_channel as enum ('email','whatsapp','sms','push');
create type notification_status  as enum ('pendiente','enviado','fallido','leido');

create type customer_kind as enum ('persona_natural','persona_juridica');
