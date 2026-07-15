"use client";

import { useEffect, useRef } from "react";

type AnimationFrameCallback = (delta: number) => void;

/**
 * Runs a current React callback on each browser animation frame.
 *
 * The callback is kept in a ref so callers can pass render-local state without
 * restarting the animation loop after every render.
 */
export function useAnimationFrame(callback: AnimationFrameCallback) {
  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);
  const callbackRef = useRef<AnimationFrameCallback>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== null) {
        const delta = time - previousTimeRef.current;
        callbackRef.current(delta);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      previousTimeRef.current = null;
    };
  }, []);
}
