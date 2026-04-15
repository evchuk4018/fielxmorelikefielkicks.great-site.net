const isDev = import.meta.env.DEV;
const debugOverride = import.meta.env.VITE_DEBUG_LOGS === 'true';

const isDebugEnabled = isDev || debugOverride;

function emit(method: 'log' | 'info' | 'warn' | 'error', args: unknown[]): void {
  if (method === 'log' || method === 'info') {
    if (!isDebugEnabled) {
      return;
    }
  }

  console[method](...args);
}

export const logger = {
  debug: (...args: unknown[]): void => {
    emit('log', args);
  },
  info: (...args: unknown[]): void => {
    emit('info', args);
  },
  warn: (...args: unknown[]): void => {
    emit('warn', args);
  },
  error: (...args: unknown[]): void => {
    emit('error', args);
  },
};

export function isDebugLoggingEnabled(): boolean {
  return isDebugEnabled;
}
