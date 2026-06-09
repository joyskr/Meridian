type LogContext = Record<string, unknown>;
type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, scope: string, event: string, context?: LogContext) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    event,
    context: context ?? {}
  };

  console.log(JSON.stringify(payload));
}

export function createLogger(scope: string) {
  return {
    info(event: string, context?: LogContext) {
      write('info', scope, event, context);
    },
    warn(event: string, context?: LogContext) {
      write('warn', scope, event, context);
    },
    error(event: string, context?: LogContext) {
      write('error', scope, event, context);
    }
  };
}
