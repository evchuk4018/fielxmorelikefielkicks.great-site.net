const isDev = process.env.NODE_ENV !== 'production';
const debugOverride = process.env.DEBUG_LOGS === 'true';

const isDebugEnabled = isDev || debugOverride;

function emit(method, args) {
  if ((method === 'log' || method === 'info') && !isDebugEnabled) {
    return;
  }

  console[method](...args);
}

export const apiLogger = {
  debug: (...args) => {
    emit('log', args);
  },
  info: (...args) => {
    emit('info', args);
  },
  warn: (...args) => {
    emit('warn', args);
  },
  error: (...args) => {
    emit('error', args);
  },
};

export function isApiDebugLoggingEnabled() {
  return isDebugEnabled;
}
