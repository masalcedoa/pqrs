import type { PqrsStatus, UserRole } from '@/types/pqrs';

export type SideEffectName =
  | 'notify_acknowledgement'
  | 'notify_request_info'
  | 'create_work_order'
  | 'dispatch_response'
  | 'schedule_reposition_window'
  | 'sspd_webhook'
  | 'mark_overdue';

export type RuleName =
  | 'within_reposition_window'
  | 'has_supervisor_approval'
  | 'has_juridico_dictamen'
  | 'not_terminal';

export interface WorkflowTransition {
  from: PqrsStatus;
  to:   PqrsStatus;
  roles_allowed: UserRole[];
  requires_approval?: UserRole;
  requires_fields?: string[];
  rules?: RuleName[];
  auto_side_effects?: SideEffectName[];
}

export interface WorkflowDefinitionBody {
  initial: PqrsStatus;
  terminal: PqrsStatus[];
  transitions: WorkflowTransition[];
}

export interface WorkflowActor {
  user_id: string;
  role: UserRole;
}

export interface CaseSnapshot {
  id: string;
  org_id: string | null;
  status: PqrsStatus;
  type: string;
  category?: string | null;
  assigned_unit_id?: string | null;
  resolution_text?: string | null;
  closed_at?: string | null;
  notified_at?: string | null;
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TransitionRequest {
  to: PqrsStatus;
  actor: WorkflowActor;
  reason?: string;
  payload?: Record<string, unknown>;
}

export interface RuleResult {
  ok: boolean;
  reason?: string;
}
