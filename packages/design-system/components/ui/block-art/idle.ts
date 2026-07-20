"use client";

import { useStableMutableValue } from "@repo/design-system/hooks/use-stable-mutable-value";
import { createSeededRandom } from "@repo/design-system/lib/random";
import { delay } from "motion";
import type { useAnimate } from "motion/react";
import { useCallback, useEffect } from "react";

interface BlockArtCellPosition {
  col: number;
  index: number;
  row: number;
}

interface BlockArtIdleOptions {
  animate: BlockArtAnimate;
  animatedCellCount: number;
  animationInterval: number;
  cellData: readonly BlockArtCellPosition[];
  columnCount: number;
  containerRef: BlockArtScope;
  rowCount: number;
}

interface BlockArtIdleState {
  handleHoverEnd: (index: number) => void;
  handleHoverStart: (index: number) => void;
  isCellHovered: (index: number) => boolean;
  isCellIdleAnimated: (index: number) => boolean;
}

type BlockArtAnimate = ReturnType<typeof useAnimate<HTMLButtonElement>>[1];
type BlockArtScope = ReturnType<typeof useAnimate<HTMLButtonElement>>[0];

function getCellSelector(index: number): string {
  return `[data-cell-index="${index}"]`;
}

function getMountedCellSelector(
  containerRef: BlockArtScope,
  index: number
): string | undefined {
  const selector = getCellSelector(index);
  const element = containerRef.current?.querySelector(selector);

  if (!element) {
    return;
  }

  return selector;
}

function getDistanceFromCenter(
  cell: BlockArtCellPosition,
  centerCol: number,
  centerRow: number
): number {
  return Math.sqrt((cell.col - centerCol) ** 2 + (cell.row - centerRow) ** 2);
}

/**
 * Owns the hover state and cancellable idle-wave lifecycle for a block-art grid.
 */
export function useBlockArtIdle({
  animate,
  animatedCellCount,
  animationInterval,
  cellData,
  columnCount,
  containerRef,
  rowCount,
}: BlockArtIdleOptions): BlockArtIdleState {
  const idleAnimatedIndices = useStableMutableValue(() => new Set<number>());
  const hoveredCells = useStableMutableValue(() => new Set<number>());
  const random = useStableMutableValue(() =>
    createSeededRandom(columnCount, rowCount, animatedCellCount)
  );

  const handleHoverStart = useCallback(
    (index: number) => {
      hoveredCells.add(index);
      const selector = getMountedCellSelector(containerRef, index);

      if (!selector) {
        return;
      }

      animate(selector, { backgroundColor: "var(--primary)" }, { duration: 0 });
    },
    [animate, containerRef, hoveredCells]
  );

  const handleHoverEnd = useCallback(
    (index: number) => {
      hoveredCells.delete(index);
      const selector = getMountedCellSelector(containerRef, index);

      if (!selector) {
        return;
      }

      if (idleAnimatedIndices.has(index)) {
        animate(
          selector,
          { backgroundColor: "var(--secondary)" },
          { duration: 0.4, ease: "easeOut" }
        );
        return;
      }

      animate(
        selector,
        {
          backgroundColor: "var(--background)",
          scale: 1,
        },
        { duration: 0.8, ease: "easeOut" }
      );
    },
    [animate, containerRef, hoveredCells, idleAnimatedIndices]
  );

  const isCellHovered = useCallback(
    (index: number) => hoveredCells.has(index),
    [hoveredCells]
  );

  const isCellIdleAnimated = useCallback(
    (index: number) => idleAnimatedIndices.has(index),
    [idleAnimatedIndices]
  );

  useEffect(() => {
    const totalCells = cellData.length;
    if (totalCells === 0 || animatedCellCount === 0) {
      return;
    }

    idleAnimatedIndices.clear();
    hoveredCells.clear();

    const scheduledAnimations = new Set<() => void>();
    const cancelScheduledAnimations = () => {
      for (const cancelAnimation of scheduledAnimations) {
        cancelAnimation();
      }
      scheduledAnimations.clear();
    };

    const effectiveAnimatedCellCount = Math.max(
      3,
      Math.min(Math.floor(totalCells * 0.12), animatedCellCount)
    );
    const centerCol = Math.floor(columnCount / 2);
    const centerRow = Math.floor(rowCount / 2);

    const updateIdleAnimation = () => {
      cancelScheduledAnimations();

      for (const index of idleAnimatedIndices) {
        if (hoveredCells.has(index)) {
          continue;
        }

        const cell = cellData[index];
        if (!cell) {
          continue;
        }

        const selector = getCellSelector(index);
        const distance = getDistanceFromCenter(cell, centerCol, centerRow);
        const cancelAnimation = delay(() => {
          if (hoveredCells.has(index)) {
            return;
          }
          if (!containerRef.current?.querySelector(selector)) {
            return;
          }

          animate(
            selector,
            { backgroundColor: "var(--background)" },
            { duration: 0.4, ease: "easeOut" }
          );
        }, distance * 0.04);
        scheduledAnimations.add(cancelAnimation);
      }
      idleAnimatedIndices.clear();

      const availableIndices = Array.from(
        { length: totalCells },
        (_, index) => index
      );
      const selectedIndices = random
        .shuffle(availableIndices)
        .slice(0, effectiveAnimatedCellCount);
      selectedIndices.sort((leftIndex, rightIndex) => {
        const leftCell = cellData[leftIndex];
        const rightCell = cellData[rightIndex];
        const leftDistance = getDistanceFromCenter(
          leftCell,
          centerCol,
          centerRow
        );
        const rightDistance = getDistanceFromCenter(
          rightCell,
          centerCol,
          centerRow
        );
        return leftDistance - rightDistance;
      });

      selectedIndices.forEach((index, order) => {
        if (hoveredCells.has(index)) {
          return;
        }

        const cell = cellData[index];
        const distance = getDistanceFromCenter(cell, centerCol, centerRow);
        idleAnimatedIndices.add(index);

        const selector = getCellSelector(index);
        const cancelAnimation = delay(
          () => {
            if (hoveredCells.has(index)) {
              return;
            }
            if (!containerRef.current?.querySelector(selector)) {
              return;
            }

            animate(
              selector,
              { backgroundColor: "var(--secondary)" },
              { duration: 0.5, ease: "easeOut" }
            );
          },
          distance * 0.05 + order * 0.025
        );
        scheduledAnimations.add(cancelAnimation);
      });
    };

    updateIdleAnimation();
    const intervalId = setInterval(updateIdleAnimation, animationInterval);

    return () => {
      clearInterval(intervalId);
      cancelScheduledAnimations();

      for (const index of idleAnimatedIndices) {
        if (hoveredCells.has(index)) {
          continue;
        }

        const selector = getMountedCellSelector(containerRef, index);
        if (!selector) {
          continue;
        }

        animate(
          selector,
          { backgroundColor: "var(--background)" },
          { duration: 0.4, ease: "easeOut" }
        );
      }
      idleAnimatedIndices.clear();
    };
  }, [
    animate,
    animatedCellCount,
    animationInterval,
    cellData,
    columnCount,
    containerRef,
    hoveredCells,
    idleAnimatedIndices,
    random,
    rowCount,
  ]);

  return {
    handleHoverEnd,
    handleHoverStart,
    isCellHovered,
    isCellIdleAnimated,
  };
}
