type LogContext = Record<string, boolean | number | string | null | undefined>;

function write(level: 'error' | 'info' | 'warn', message: string, context?: LogContext) {
  if (!__DEV__ && level === 'info') {
    return;
  }

  const payload = context ? { context, message } : { message };
  console[level](payload);
}

export const logger = {
  error: (message: string, context?: LogContext) => write('error', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
};
