/**
 * Tiny typed event emitter. The whole "framework" event layer is this file.
 *
 *   const bus = createEmitter<MyEvents>();
 *   const off = bus.on('thing', (p) => ...);  // on() returns its own unsubscribe
 *   bus.emit('thing', payload);
 *   off();
 */
export type Unsubscribe = () => void;

export interface Emitter<E extends Record<string, any>> {
  /** Subscribe. Returns an unsubscribe function (there is intentionally no public `off`). */
  on<K extends keyof E>(name: K, fn: (payload: E[K]) => void): Unsubscribe;
  emit<K extends keyof E>(name: K, payload: E[K]): void;
  /** Drop every listener — called once by engine.destroy(). */
  clear(): void;
}

export function createEmitter<E extends Record<string, any>>(): Emitter<E> {
  const listeners = new Map<keyof E, Set<(payload: any) => void>>();

  return {
    on(name, fn) {
      let set = listeners.get(name);
      if (!set) {
        set = new Set();
        listeners.set(name, set);
      }
      set.add(fn as (payload: any) => void);
      return () => {
        set!.delete(fn as (payload: any) => void);
      };
    },
    emit(name, payload) {
      const set = listeners.get(name);
      if (!set) return;
      // Iterate a copy so a listener may unsubscribe (or subscribe) during dispatch.
      for (const fn of [...set]) fn(payload);
    },
    clear() {
      listeners.clear();
    },
  };
}
