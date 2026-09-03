export function info(...args: unknown[]) {
  console.log('[INFO]', ...args);
}
export function warn(...args: unknown[]) {
  console.warn('[WARN]', ...args);
}
export function error(...args: unknown[]) {
  console.error('[ERROR]', ...args);
}
export function debug(...args: unknown[]) {
  if (process.env.DEBUG) console.debug('[DEBUG]', ...args);
}
