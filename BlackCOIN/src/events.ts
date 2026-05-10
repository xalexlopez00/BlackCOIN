type Handler = (...args: any[]) => void;

const listeners = new Map<string, Handler[]>();

export function on(event: string, handler: Handler): void {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event)!.push(handler);
}

export function off(event: string, handler: Handler): void {
  const hs = listeners.get(event);
  if (!hs) return;
  const idx = hs.indexOf(handler);
  if (idx !== -1) hs.splice(idx, 1);
}

export function emit(event: string, ...args: any[]): void {
  const hs = listeners.get(event);
  if (!hs) return;
  for (const h of hs) h(...args);
}
