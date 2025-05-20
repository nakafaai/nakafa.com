"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type Props = {
  gridCols?: number;
  gridRows?: number;
  className?: string;
  animationColor?: string;
  animatedCellCount?: number;
  animationInterval?: number;
};

const DEFAULT_ANIMATION_COLOR = "bg-secondary";
const DEFAULT_ANIMATED_CELL_COUNT = 15;
const DEFAULT_ANIMATION_INTERVAL = 1000; // ms

export function BlockArt({
  gridCols = 16,
  gridRows = 8,
  className,
  animationColor = DEFAULT_ANIMATION_COLOR,
  animatedCellCount = DEFAULT_ANIMATED_CELL_COUNT,
  animationInterval = DEFAULT_ANIMATION_INTERVAL,
}: Props) {
  const COLS = Math.max(1, Math.floor(gridCols));
  const ROWS = Math.max(1, Math.floor(gridRows));
  const totalCells = COLS * ROWS;

  const [activeIndices, setActiveIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (totalCells === 0 || animatedCellCount === 0) {
      setActiveIndices(new Set());
      return;
    }

    const effectiveAnimatedCellCount = Math.min(animatedCellCount, totalCells);

    const intervalId = setInterval(() => {
      const newActiveIndices = new Set<number>();
      const availableIndices = Array.from({ length: totalCells }, (_, i) => i);

      for (let i = availableIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableIndices[i], availableIndices[j]] = [
          availableIndices[j],
          availableIndices[i],
        ];
      }

      for (let i = 0; i < effectiveAnimatedCellCount; i++) {
        newActiveIndices.add(availableIndices[i]);
      }
      setActiveIndices(newActiveIndices);
    }, animationInterval);

    return () => clearInterval(intervalId);
  }, [totalCells, animatedCellCount, animationInterval]);

  return (
    <section
      className={cn("h-full w-full bg-border pt-px lg:py-px", className)}
    >
      <div
        className="h-full w-full"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, auto)`,
          gap: "1px",
        }}
      >
        {Array.from({ length: totalCells }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "transition-colors duration-300 ease-in-out hover:bg-primary",
              activeIndices.has(i) ? animationColor : "bg-background"
            )}
            style={{ aspectRatio: "1 / 1" }}
          />
        ))}
      </div>
    </section>
  );
}
