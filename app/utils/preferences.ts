// Browser-only preferences. Storage denial must never block audio or controls.
export function readPreference<T extends string>(key: string, allowed?: readonly T[]): T | '' {
  try {
    const value = localStorage.getItem(key) || '';
    return (!allowed || allowed.includes(value as T) ? value : '') as T | '';
  } catch { return ''; }
}

export function writePreference(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Session settings still work. */ }
}
