export type UserRole =
  | 'ciudadano' | 'agente' | 'analista' | 'supervisor'
  | 'juridico'  | 'tecnico' | 'admin'    | 'auditor';

export type PqrsType =
  | 'peticion' | 'queja' | 'reclamo'
  | 'recurso_reposicion' | 'recurso_apelacion'
  | 'denuncia' | 'solicitud_tecnica';

export type PqrsChannel =
  | 'portal' | 'chat_ia' | 'whatsapp' | 'email'
  | 'telefono' | 'presencial' | 'oficio' | 'api';

export type PqrsPriority = 'baja' | 'media' | 'alta' | 'critica';

export type PqrsStatus =
  | 'radicado' | 'en_validacion' | 'clasificado' | 'asignado'
  | 'en_analisis' | 'pendiente_informacion' | 'orden_generada'
  | 'en_visita_tecnica' | 'en_revision_comercial' | 'en_revision_juridica'
  | 'respuesta_proyectada' | 'resuelto' | 'notificado'
  | 'en_recurso_reposicion' | 'en_apelacion' | 'escalado_sspd'
  | 'cerrado' | 'vencido';

export type PqrsCategory =
  | 'facturacion' | 'lectura' | 'consumo_elevado' | 'suspension'
  | 'reconexion' | 'medidor' | 'calidad_servicio' | 'dano_electrico'
  | 'atencion_usuario' | 'cobros' | 'otro';

export type WorkOrderType =
  | 'revision_facturacion' | 'visita_tecnica' | 'inspeccion_medidor'
  | 'suspension' | 'reconexion' | 'revision_lectura'
  | 'ajuste_comercial' | 'analisis_juridico';

export interface PqrsCase {
  id: string;
  radicado: string;
  type: PqrsType;
  category?: PqrsCategory | null;
  subcategory?: string | null;
  causal?: string | null;
  priority: PqrsPriority;
  status: PqrsStatus;
  channel: PqrsChannel;
  customer_id: string;
  service_account_id?: string | null;
  meter_id?: string | null;
  assigned_unit_id?: string | null;
  assigned_to?: string | null;
  summary?: string | null;
  narrative: string;
  received_at: string;
  legal_term_days: number;
  due_at?: string | null;
  closed_at?: string | null;
  resolution_text?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PqrsRadicacionInput {
  customer: {
    kind: 'persona_natural' | 'persona_juridica';
    document_type: 'CC' | 'CE' | 'NIT' | 'TI' | 'PA';
    document_id: string;
    full_name: string;
    email?: string;
    phone?: string;
  };
  service_account?: {
    account_number: string;
    address?: string;
    municipality?: string;
  };
  type: PqrsType;
  category?: PqrsCategory;
  narrative: string;
  channel?: PqrsChannel;
  attachments?: Array<{ path: string; name: string; mime: string; size: number }>;
}
