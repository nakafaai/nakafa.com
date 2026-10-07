"use client";

import { useCallback, useState } from "react";

type SetState<T> = (value: T) => void;
type ControllableState<T> = [T, SetState<T>];
type ControllableChange<T> = (value: T) => void;

/**
 * Keeps a value that `prop` controls when it is defined, and otherwise a local
 * value that starts at `defaultProp`. `onChange` receives every new value.
 */
export function useControllableState<T>(
  defaultProp: T,
  prop: T | undefined,
  onChange?: ControllableChange<T>
): ControllableState<T> {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultProp);
  const value = prop === undefined ? uncontrolledValue : prop;

  const setValue = useCallback<SetState<T>>(
    (resolvedValue) => {
      if (prop === undefined) {
        setUncontrolledValue(resolvedValue);
      }

      onChange?.(resolvedValue);
    },
    [onChange, prop]
  );

  return [value, setValue];
}
