"use client";

import { useStableMutableValue } from "@repo/design-system/hooks/use-stable-mutable-value";
import type { useAnimate } from "motion/react";
import { useCallback, useEffect, useRef } from "react";

interface BlockArtRippleAnimationOptions {
  animate: BlockArtAnimate;
  columnCount: number;
  containerRef: BlockArtScope;
  isCellHovered: (index: number) => boolean;
  isCellIdleAnimated: (index: number) => boolean;
  rowCount: number;
  waveDuration: number;
}

interface Ripple {
  startTime: number;
  x: number;
  y: number;
}

type BlockArtAnimate = ReturnType<typeof useAnimate<HTMLButtonElement>>[1];
type BlockArtScope = ReturnType<typeof useAnimate<HTMLButtonElement>>[0];

const MAX_CONCURRENT_RIPPLES = 3;
const RIPPLE_RADIUS_MULTIPLIER = 1.5;
const RIPPLE_WAVE_WIDTH = 2;

function getWaveIntensity(
  distance: number,
  radius: number,
  progress: number
): number {
  const waveHalfWidth = RIPPLE_WAVE_WIDTH / 2;
  const distanceFromWave = Math.abs(distance - radius);

  if (distanceFromWave > waveHalfWidth) {
    return 0;
  }

  const normalizedDistance = distanceFromWave / waveHalfWidth;
  return (1 - normalizedDistance ** 2) * (1 - progress);
}

/** Runs and restores the animation frames for concurrent block-art ripples. */
export function useBlockArtRippleAnimation({
  animate,
  columnCount,
  containerRef,
  isCellHovered,
  isCellIdleAnimated,
  rowCount,
  waveDuration,
}: BlockArtRippleAnimationOptions): (
  x: number,
  y: number,
  now: number
) => void {
  const animationFrameRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const lastAffectedCells = useStableMutableValue(() => new Set<number>());
  const ripplesRef = useRef<Ripple[]>([]);

  const updateCellStyle = useCallback(
    (cellIndex: number, intensity: number) => {
      const selector = `[data-cell-index="${cellIndex}"]`;
      if (!containerRef.current?.querySelector(selector)) {
        return;
      }

      if (intensity > 0.01) {
        const scale = 1 + intensity * 0.08;
        const colorOpacity = Math.round(intensity * 85);
        const glowBlur = Math.round(6 + intensity * 10);
        const glowOpacity = Math.round(intensity * 50);

        animate(
          selector,
          {
            scale,
            backgroundColor: `color-mix(in oklch, var(--primary) ${colorOpacity}%, var(--background))`,
            boxShadow: `0 0 ${glowBlur}px color-mix(in oklch, var(--primary) ${glowOpacity}%, transparent)`,
            zIndex: 10,
          },
          { duration: 0 }
        );
        return;
      }

      if (isCellHovered(cellIndex)) {
        animate(
          selector,
          {
            scale: 1.02,
            backgroundColor: "var(--primary)",
            boxShadow: "0 0 0px transparent",
            zIndex: 0,
          },
          { duration: 0 }
        );
        return;
      }

      if (isCellIdleAnimated(cellIndex)) {
        animate(
          selector,
          {
            scale: 1,
            backgroundColor: "var(--secondary)",
            boxShadow: "0 0 0px transparent",
            zIndex: 0,
          },
          { duration: 0.4, ease: "easeOut" }
        );
        return;
      }

      animate(
        selector,
        {
          scale: 1,
          backgroundColor: "var(--background)",
          boxShadow: "0 0 0px transparent",
          zIndex: 0,
        },
        { type: "spring", stiffness: 350, damping: 28, mass: 0.9 }
      );
    },
    [animate, containerRef, isCellHovered, isCellIdleAnimated]
  );

  const animateRipples = useCallback(() => {
    const currentTime = performance.now();
    const currentRipples = ripplesRef.current;
    const activeRipples = currentRipples.filter(
      (ripple) => currentTime - ripple.startTime <= waveDuration
    );
    const hasExpiredRipples = activeRipples.length !== currentRipples.length;
    const limitedRipples = activeRipples.slice(-MAX_CONCURRENT_RIPPLES);
    const affectedCells = new Map<number, number>();

    for (const ripple of limitedRipples) {
      const elapsed = currentTime - ripple.startTime;
      const progress = elapsed / waveDuration;
      const radius =
        progress * Math.max(columnCount, rowCount) * RIPPLE_RADIUS_MULTIPLIER;
      const searchRadius = radius + RIPPLE_WAVE_WIDTH;
      const minRow = Math.max(0, Math.floor(ripple.y - searchRadius));
      const maxRow = Math.min(rowCount - 1, Math.ceil(ripple.y + searchRadius));
      const minCol = Math.max(0, Math.floor(ripple.x - searchRadius));
      const maxCol = Math.min(
        columnCount - 1,
        Math.ceil(ripple.x + searchRadius)
      );

      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          const distance = Math.sqrt(
            (col - ripple.x) ** 2 + (row - ripple.y) ** 2
          );
          const intensity = getWaveIntensity(distance, radius, progress);
          if (intensity <= 0) {
            continue;
          }

          const cellIndex = row * columnCount + col;
          const existingIntensity = affectedCells.get(cellIndex) ?? 0;
          if (intensity > existingIntensity) {
            affectedCells.set(cellIndex, intensity);
          }
        }
      }
    }

    for (const [cellIndex, intensity] of affectedCells) {
      updateCellStyle(cellIndex, intensity);
    }
    for (const cellIndex of lastAffectedCells) {
      if (!affectedCells.has(cellIndex)) {
        updateCellStyle(cellIndex, 0);
      }
    }

    lastAffectedCells.clear();
    for (const cellIndex of affectedCells.keys()) {
      lastAffectedCells.add(cellIndex);
    }

    if (hasExpiredRipples) {
      ripplesRef.current = activeRipples;
    }
    if (limitedRipples.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animateRipples);
      return;
    }

    isAnimatingRef.current = false;
    lastAffectedCells.clear();
  }, [columnCount, lastAffectedCells, rowCount, updateCellStyle, waveDuration]);

  const startAnimation = useCallback(() => {
    isAnimatingRef.current = true;
    animationFrameRef.current = requestAnimationFrame(animateRipples);
  }, [animateRipples]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden || ripplesRef.current.length === 0) {
        return;
      }
      if (isAnimatingRef.current) {
        return;
      }

      startAnimation();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [startAnimation]);

  useEffect(
    () => () => {
      cancelAnimationFrame(animationFrameRef.current);
    },
    []
  );

  return useCallback(
    (x: number, y: number, now: number) => {
      const ripple = {
        startTime: now,
        x,
        y,
      };
      ripplesRef.current = [...ripplesRef.current, ripple].slice(
        -MAX_CONCURRENT_RIPPLES
      );

      if (!isAnimatingRef.current) {
        startAnimation();
      }
    },
    [startAnimation]
  );
}
