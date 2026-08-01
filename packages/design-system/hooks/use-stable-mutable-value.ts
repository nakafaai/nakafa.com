"use client";

import { useState } from "react";

/**
 * Creates one stable mutable value through React's lazy state initialization.
 *
 * @see https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state
 */
export function useStableMutableValue<T>(createValue: () => T): T {
  const [value] = useState(createValue);
  return value;
}
