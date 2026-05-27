import { useCallback, useEffect, useRef } from "react";

export function useThrottledCallback<T extends unknown[]>(
  callback: (...args: T) => void,
  delayMs: number
) {
  const callbackRef = useRef(callback);
  const pendingArgsRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const args = pendingArgsRef.current;
    if (args) {
      pendingArgsRef.current = null;
      callbackRef.current(...args);
    }
  }, []);

  const throttled = useCallback(
    (...args: T) => {
      pendingArgsRef.current = args;

      if (timerRef.current !== null) {
        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingArgsRef.current;
        if (pending) {
          pendingArgsRef.current = null;
          callbackRef.current(...pending);
        }
      }, delayMs);
    },
    [delayMs]
  );

  return { throttled, flush };
}
