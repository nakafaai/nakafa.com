"use client";

import { useCallback, useState } from "react";

interface UseControllableStateProps<T> {
  defaultProp: T;
  onChange?: (value: T) => void;
  prop?: T;
}

type SetState<T> = (value: T) => void;
type ControllableState<T> = [T, SetState<T>];

export function useControllableState<T>({
  defaultProp,
  onChange,
  prop,
}: UseControllableStateProps<T>): ControllableState<T> {
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
