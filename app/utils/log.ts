export function log(...args: unknown[]) {
  if (import.meta.dev) console.log(...args);
}
