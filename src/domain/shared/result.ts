export type Result<T, E = AppError> =
  | { ok: true;  value: T }
  | { ok: false; error: E };

export const Ok  = <T>(value: T): Result<T, never> => ({ ok: true,  value });
export const Err = <E extends AppError>(error: E): Result<never, E> => ({ ok: false, error });

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
  toJSON() { return { code: this.code, message: this.message, details: this.details }; }
}

export class NotAuthorizedError extends AppError {
  constructor(reason: string) { super('not_authorized', reason); }
}
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) { super('validation_error', message, details); }
}
export class NotFoundError extends AppError {
  constructor(entity: string, id: string) { super('not_found', `${entity} ${id} no encontrado`); }
}
export class WorkflowError extends AppError {
  constructor(reason: string, details?: unknown) { super('workflow_error', reason, details); }
}
export class LimitExceededError extends AppError {
  constructor(limit: string) { super('limit_exceeded', `Límite del plan superado: ${limit}`); }
}
