"use client";

import { m } from "motion/react";
import { memo } from "react";

interface BlockArtCellProps {
  col: number;
  index: number;
  onHoverEnd: (index: number) => void;
  onHoverStart: (index: number) => void;
  row: number;
}

/** Renders one animated cell and reports its hover transitions to the grid. */
export const BlockArtCell = memo(function BlockArtCell({
  index,
  row,
  col,
  onHoverStart,
  onHoverEnd,
}: BlockArtCellProps) {
  return (
    <m.div
      className="size-full will-change-transform"
      data-cell-index={index}
      data-col={col}
      data-row={row}
      initial={{
        backgroundColor: "var(--background)",
        scale: 1,
      }}
      onHoverEnd={() => onHoverEnd(index)}
      onHoverStart={() => onHoverStart(index)}
      style={{
        aspectRatio: "1 / 1",
        contain: "layout style paint",
      }}
      transition={{
        backgroundColor: { duration: 0.6, ease: "easeOut" },
      }}
    />
  );
});
