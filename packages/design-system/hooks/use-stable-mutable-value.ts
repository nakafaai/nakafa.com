"use client";

import { useRef } from "react";

/**
 * Creates one stable mutable value during render without recreating it on every
 * render.
 *
 * @see https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents
 */
export function useStableMutableValue<T>(createValue: () => T): T {
  const valueRef = useRef<T | null>(null);

  if (valueRef.current === null) {
    valueRef.current = createValue();
  }

  return valueRef.current;
}
