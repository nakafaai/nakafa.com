"use client";

import { useMediaQuery } from "@mantine/hooks";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { cn } from "@repo/design-system/lib/utils";
import {
  domAnimation,
  LazyMotion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import { useMemo } from "react";

import { BlockArtCell } from "./block-art/cell";
import { useBlockArtIdle } from "./block-art/idle";
import { useBlockArtRipple } from "./block-art/ripple";

/** Configuration for the interactive block-art grid. */
interface BlockArtProps {
  animatedCellCount?: number;
  animationInterval?: number;
  className?: string;
  gridCols?: number;
  gridRows?: number;
  onCellClick?: () => void;
  waveDuration?: number;
}

const DEFAULT_ANIMATED_CELL_COUNT = 15;
const DEFAULT_ANIMATION_INTERVAL = 2000;
const DEFAULT_WAVE_DURATION = 2000;

/** Renders an interactive grid with independent idle, hover, and ripple motion. */
export function BlockArt({
  gridCols,
  gridRows,
  className,
  animatedCellCount = DEFAULT_ANIMATED_CELL_COUNT,
  animationInterval = DEFAULT_ANIMATION_INTERVAL,
  waveDuration = DEFAULT_WAVE_DURATION,
  onCellClick,
}: BlockArtProps) {
  const isLaptop = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.xlAndUp);
  const shouldReduceMotion = useReducedMotion() ?? false;

  let defaultColumnCount = 8;
  let defaultRowCount = 4;
  if (isDesktop) {
    defaultColumnCount = 18;
    defaultRowCount = 8;
  } else if (isLaptop) {
    defaultColumnCount = 16;
    defaultRowCount = 7;
  }

  const columnCount = Math.max(1, Math.floor(gridCols ?? defaultColumnCount));
  const rowCount = Math.max(1, Math.floor(gridRows ?? defaultRowCount));
  const totalCells = columnCount * rowCount;
  const [containerRef, animate] = useAnimate<HTMLButtonElement>();
  const cellData = useMemo(
    () =>
      Array.from({ length: totalCells }, (_, index) => ({
        col: index % columnCount,
        index,
        row: Math.floor(index / columnCount),
      })),
    [columnCount, totalCells]
  );

  const {
    handleHoverEnd,
    handleHoverStart,
    isCellHovered,
    isCellIdleAnimated,
  } = useBlockArtIdle({
    animate,
    animatedCellCount,
    animationInterval,
    cellData,
    columnCount,
    containerRef,
    rowCount,
  });
  const { handleClick, handleKeyDown } = useBlockArtRipple({
    animate,
    columnCount,
    containerRef,
    isCellHovered,
    isCellIdleAnimated,
    onCellClick,
    rowCount,
    shouldReduceMotion,
    waveDuration,
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <section className={cn("size-full bg-border p-px", className)}>
        <button
          aria-label="Interactive grid art with wave effect"
          className="size-full cursor-pointer"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          ref={containerRef}
          style={{
            display: "grid",
            gap: "1px",
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rowCount}, auto)`,
          }}
          type="button"
        >
          {cellData.map(({ index, row, col }) => (
            <BlockArtCell
              col={col}
              index={index}
              key={`${row}-${col}`}
              onHoverEnd={handleHoverEnd}
              onHoverStart={handleHoverStart}
              row={row}
            />
          ))}
        </button>
      </section>
    </LazyMotion>
  );
}
