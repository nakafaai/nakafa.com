"use client";

import type { useAnimate } from "motion/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useRef,
} from "react";

import { useBlockArtRippleAnimation } from "./ripple-animation";

interface BlockArtRippleOptions {
  animate: BlockArtAnimate;
  columnCount: number;
  containerRef: BlockArtScope;
  isCellHovered: (index: number) => boolean;
  isCellIdleAnimated: (index: number) => boolean;
  onCellClick?: () => void;
  rowCount: number;
  shouldReduceMotion: boolean;
  waveDuration: number;
}

interface BlockArtRippleState {
  handleClick: (event: MouseEvent<HTMLButtonElement>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

type BlockArtAnimate = ReturnType<typeof useAnimate<HTMLButtonElement>>[1];
type BlockArtScope = ReturnType<typeof useAnimate<HTMLButtonElement>>[0];

const RIPPLE_THROTTLE_MS = 500;

/** Maps grid input to throttled, cancellable ripple animations. */
export function useBlockArtRipple({
  animate,
  columnCount,
  containerRef,
  isCellHovered,
  isCellIdleAnimated,
  onCellClick,
  rowCount,
  shouldReduceMotion,
  waveDuration,
}: BlockArtRippleOptions): BlockArtRippleState {
  const lastRippleAtRef = useRef<number | null>(null);
  const startRippleAnimation = useBlockArtRippleAnimation({
    animate,
    columnCount,
    containerRef,
    isCellHovered,
    isCellIdleAnimated,
    rowCount,
    waveDuration,
  });

  const triggerRipple = useCallback(
    (x: number, y: number) => {
      const now = performance.now();
      const lastRippleAt = lastRippleAtRef.current;
      if (lastRippleAt !== null && now - lastRippleAt < RIPPLE_THROTTLE_MS) {
        return;
      }

      lastRippleAtRef.current = now;
      onCellClick?.();

      if (shouldReduceMotion) {
        return;
      }

      startRippleAnimation(x, y, now);
    },
    [onCellClick, shouldReduceMotion, startRippleAnimation]
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target !== container &&
        container.contains(target)
      ) {
        const cellIndexValue = target.getAttribute("data-cell-index");
        if (cellIndexValue) {
          const cellIndex = Number.parseInt(cellIndexValue, 10);
          triggerRipple(
            cellIndex % columnCount,
            Math.floor(cellIndex / columnCount)
          );
          return;
        }
      }

      const rect = container.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;
      const col = Math.min(
        Math.floor((clickX / rect.width) * columnCount),
        columnCount - 1
      );
      const row = Math.min(
        Math.floor((clickY / rect.height) * rowCount),
        rowCount - 1
      );

      triggerRipple(col, row);
    },
    [columnCount, containerRef, rowCount, triggerRipple]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      triggerRipple(Math.floor(columnCount / 2), Math.floor(rowCount / 2));
    },
    [columnCount, rowCount, triggerRipple]
  );

  return { handleClick, handleKeyDown };
}
