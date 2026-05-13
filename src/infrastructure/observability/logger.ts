/**
 * Logger estructurado JSON-line. Compatible con Vercel logs y herramientas SIEM.
 * Para producción, conectar OpenTelemetry / Sentry exportando estas líneas.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

interface LogFields {
  msg: string;
  err?: unknown;
  [key: string]: unknown;
}

function emit(level: Level, fields: LogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    ...fields,
    err: fields.err instanceof Error
      ? { name: fields.err.name, message: fields.err.message, stack: fields.err.stack }
      : fields.err
  });
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const logger = {
  debug: (msg: string, fields: Omit<LogFields, 'msg'> = {}) => emit('debug', { msg, ...fields }),
  info:  (msg: string, fields: Omit<LogFields, 'msg'> = {}) => emit('info',  { msg, ...fields }),
  warn:  (msg: string, fields: Omit<LogFields, 'msg'> = {}) => emit('warn',  { msg, ...fields }),
  error: (msg: string, fields: Omit<LogFields, 'msg'> = {}) => emit('error', { msg, ...fields })
};

export function childLogger(scope: Record<string, unknown>) {
  return {
    debug: (m: string, f: Record<string, unknown> = {}) => emit('debug', { msg: m, ...scope, ...f }),
    info:  (m: string, f: Record<string, unknown> = {}) => emit('info',  { msg: m, ...scope, ...f }),
    warn:  (m: string, f: Record<string, unknown> = {}) => emit('warn',  { msg: m, ...scope, ...f }),
    error: (m: string, f: Record<string, unknown> = {}) => emit('error', { msg: m, ...scope, ...f })
  };
}
