/**
 * Mount a set of feature modules against an engine, scoped to a root element.
 * Returns a single teardown that aborts all module listeners (via a shared
 * AbortSignal) and runs each module's own teardown in LIFO order.
 */
import type { OpenKeysEngine, OpenKeysModule, Teardown } from './types';

export function composeModules(
  engine: OpenKeysEngine,
  root: HTMLElement,
  modules: OpenKeysModule[]
): Teardown {
  const controller = new AbortController();
  const teardowns = modules.map((module) =>
    module({ engine, host: root, signal: controller.signal })
  );

  return () => {
    controller.abort(); // removes every addEventListener({ signal }) a module registered
    for (const teardown of teardowns.reverse()) {
      try {
        teardown();
      } catch {
        /* keep tearing down the rest */
      }
    }
  };
}
