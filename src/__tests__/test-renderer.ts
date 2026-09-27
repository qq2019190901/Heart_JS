import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

/**
 * Minimal test-only hook harness.
 *
 * The project has no @testing-library/react dependency, and adding one just for
 * a handful of assertions is not worth the supply-chain cost. This renders the
 * hook inside a throwaway container and exposes its latest return value.
 */
export function renderHook<T>(useHook: () => T): { result: { current: T }; unmount: () => void } {
  // Tell React it is running under a test environment, otherwise `act()`
  // logs "The current testing environment is not configured to support act(...)".
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

  const container = document.createElement('div');
  document.body.appendChild(container);

  const result = { current: undefined as unknown as T };
  let root: Root;

  function Probe() {
    result.current = useHook();
    return null;
  }

  act(() => {
    root = createRoot(container);
    root.render(React.createElement(Probe));
  });

  return {
    result,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

export { act };
