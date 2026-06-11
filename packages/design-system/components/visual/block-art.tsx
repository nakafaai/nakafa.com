"use client";

import { useMediaQuery } from "@mantine/hooks";
import { useStableMutableValue } from "@repo/design-system/hooks/use-stable-mutable-value";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import { createSeededRandom } from "@repo/design-system/lib/random";
import { cn } from "@repo/design-system/lib/utils";
import {
  domAnimation,
  LazyMotion,
  MotionConfig,
  m,
  useAnimate,
} from "motion/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

interface BlockArtProps {
  animatedCellCount?: number;
  animationColor?: string;
  animationInterval?: number;
  className?: string;
  gridCols?: number;
  gridRows?: number;
  onCellClick?: () => void;
  waveDuration?: number;
}

interface Ripple {
  id: number;
  startTime: number;
  x: number;
  y: number;
}

interface BlockCellProps {
  col: number;
  index: number;
  onHoverEnd: (index: number) => void;
  onHoverStart: (index: number) => void;
  row: number;
}

const DEFAULT_ANIMATED_CELL_COUNT = 15;
const DEFAULT_ANIMATION_INTERVAL = 2000;
const DEFAULT_WAVE_DURATION = 2000;
const MAX_CONCURRENT_RIPPLES = 3;
const RIPPLE_RADIUS_MULTIPLIER = 1.5;
const RIPPLE_WAVE_WIDTH = 2;

/**
 * Renders one animated grid cell and reports hover transitions to the grid.
 */
const MotionBlockCell = memo(function MotionBlockCell({
  index,
  row,
  col,
  onHoverStart,
  onHoverEnd,
}: BlockCellProps) {
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

/**
 * Renders an interactive animated block grid with idle and click ripple effects.
 */
export function BlockArt({
  gridCols,
  gridRows,
  className,
  animationColor: _animationColor,
  animatedCellCount = DEFAULT_ANIMATED_CELL_COUNT,
  animationInterval = DEFAULT_ANIMATION_INTERVAL,
  waveDuration = DEFAULT_WAVE_DURATION,
  onCellClick,
}: BlockArtProps) {
  const isLaptop = useMediaQuery(TAILWIND_MEDIA_QUERIES.lgAndUp);
  const isDesktop = useMediaQuery(TAILWIND_MEDIA_QUERIES.xlAndUp);

  let defaultCols = 8;
  if (isDesktop) {
    defaultCols = 18;
  } else if (isLaptop) {
    defaultCols = 16;
  }

  let defaultRows = 4;
  if (isDesktop) {
    defaultRows = 8;
  } else if (isLaptop) {
    defaultRows = 7;
  }

  const Cols = Math.max(1, Math.floor(gridCols ?? defaultCols));
  const Rows = Math.max(1, Math.floor(gridRows ?? defaultRows));
  const totalCells = Cols * Rows;

  const [containerRef, animate] = useAnimate<HTMLButtonElement>();
  const animationFrameRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);
  const rippleIdRef = useRef(0);
  const rng = useStableMutableValue(() =>
    createSeededRandom(Cols, Rows, animatedCellCount)
  );
  const ripplesRef = useRef<Ripple[]>([]);
  const isThrottledRef = useRef(false);
  const lastAffectedCells = useStableMutableValue(() => new Set<number>());
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleAnimatedIndices = useStableMutableValue(() => new Set<number>());
  const hoveredCells = useStableMutableValue(() => new Set<number>());
  const timeoutIds = useStableMutableValue(
    () => new Set<ReturnType<typeof setTimeout>>()
  );

  const cellData = useMemo(
    () =>
      Array.from({ length: totalCells }, (_, i) => ({
        index: i,
        row: Math.floor(i / Cols),
        col: i % Cols,
      })),
    [totalCells, Cols]
  );

  // Handle hover start with instant color change
  const handleHoverStart = useCallback(
    (index: number) => {
      hoveredCells.add(index);
      const selector = `[data-cell-index="${index}"]`;

      // Check if element exists before animating
      const element = containerRef.current?.querySelector(selector);
      if (!element) {
        return;
      }

      // Instant color change on hover
      animate(
        selector,
        {
          backgroundColor: "var(--primary)",
        },
        { duration: 0 }
      );
    },
    [animate, containerRef, hoveredCells]
  );

  // Handle hover end with trail effect
  const handleHoverEnd = useCallback(
    (index: number) => {
      hoveredCells.delete(index);
      const selector = `[data-cell-index="${index}"]`;

      // Check if element exists before animating
      const element = containerRef.current?.querySelector(selector);
      if (!element) {
        return;
      }

      // If cell is in idle animation, restore to secondary color
      if (idleAnimatedIndices.has(index)) {
        animate(
          selector,
          {
            backgroundColor: "var(--secondary)",
          },
          { duration: 0.4, ease: "easeOut" }
        );
        return;
      }

      // Trail effect - slow fade back to background
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

  // Staggered idle animation with wave pattern from center
  useEffect(() => {
    if (totalCells === 0 || animatedCellCount === 0) {
      return;
    }

    // Clear previous state when dimensions change
    if (idleIntervalRef.current) {
      clearInterval(idleIntervalRef.current);
    }
    idleAnimatedIndices.clear();
    hoveredCells.clear();

    const effectiveAnimatedCellCount = Math.max(
      3,
      Math.min(Math.floor(totalCells * 0.12), animatedCellCount)
    );

    const centerCol = Math.floor(Cols / 2);
    const centerRow = Math.floor(Rows / 2);

    const updateIdleAnimation = () => {
      // Clear any pending timeouts from previous animation cycle
      for (const timeoutId of timeoutIds) {
        clearTimeout(timeoutId);
      }
      timeoutIds.clear();

      // Fade out previous animations with stagger
      const prevIndices = Array.from(idleAnimatedIndices);
      for (const index of prevIndices) {
        // Skip if currently hovered
        if (hoveredCells.has(index)) {
          continue;
        }

        const selector = `[data-cell-index="${index}"]`;
        const cell = cellData[index];

        // Skip if cell doesn't exist (e.g., during resize)
        if (!cell) {
          continue;
        }

        const distanceFromCenter = Math.sqrt(
          (cell.col - centerCol) ** 2 + (cell.row - centerRow) ** 2
        );

        const timeoutId = setTimeout(() => {
          // Re-check hover state before animating
          if (hoveredCells.has(index)) {
            return;
          }

          // Check if element still exists before animating
          const element = containerRef.current?.querySelector(selector);
          if (!element) {
            return;
          }

          animate(
            selector,
            {
              backgroundColor: "var(--background)",
            },
            { duration: 0.4, ease: "easeOut" }
          );
        }, distanceFromCenter * 40);
        timeoutIds.add(timeoutId);
      }
      idleAnimatedIndices.clear();

      // Select new cells and animate with stagger from center
      const availableIndices = Array.from({ length: totalCells }, (_, i) => i);
      const shuffledIndices = rng.shuffle(availableIndices);
      const selectedIndices = shuffledIndices.slice(
        0,
        effectiveAnimatedCellCount
      );

      // Sort by distance from center for wave effect
      const sortedByDistance = selectedIndices.sort((a, b) => {
        const cellA = cellData[a];
        const cellB = cellData[b];
        const distA = Math.sqrt(
          (cellA.col - centerCol) ** 2 + (cellA.row - centerRow) ** 2
        );
        const distB = Math.sqrt(
          (cellB.col - centerCol) ** 2 + (cellB.row - centerRow) ** 2
        );
        return distA - distB;
      });

      sortedByDistance.forEach((index, i) => {
        // Skip if currently hovered
        if (hoveredCells.has(index)) {
          return;
        }

        const cell = cellData[index];
        const distanceFromCenter = Math.sqrt(
          (cell.col - centerCol) ** 2 + (cell.row - centerRow) ** 2
        );

        idleAnimatedIndices.add(index);
        const selector = `[data-cell-index="${index}"]`;

        // Stagger delay based on distance from center
        const timeoutId = setTimeout(
          () => {
            // Re-check hover state before animating
            if (hoveredCells.has(index)) {
              return;
            }

            // Check if element still exists before animating
            const element = containerRef.current?.querySelector(selector);
            if (!element) {
              return;
            }

            animate(
              selector,
              {
                backgroundColor: "var(--secondary)",
              },
              {
                duration: 0.5,
                ease: "easeOut",
              }
            );
          },
          distanceFromCenter * 50 + i * 25
        );
        timeoutIds.add(timeoutId);
      });
    };

    updateIdleAnimation();

    idleIntervalRef.current = setInterval(
      updateIdleAnimation,
      animationInterval
    );

    return () => {
      if (idleIntervalRef.current) {
        clearInterval(idleIntervalRef.current);
      }
      // Clear all pending timeouts
      for (const timeoutId of timeoutIds) {
        clearTimeout(timeoutId);
      }
      timeoutIds.clear();
      // Reset all idle animated cells
      for (const index of idleAnimatedIndices) {
        if (hoveredCells.has(index)) {
          continue;
        }
        const selector = `[data-cell-index="${index}"]`;

        // Check if element still exists before animating
        const element = containerRef.current?.querySelector(selector);
        if (!element) {
          continue;
        }

        animate(
          selector,
          {
            backgroundColor: "var(--background)",
          },
          { duration: 0.4, ease: "easeOut" }
        );
      }
      idleAnimatedIndices.clear();
    };
  }, [
    totalCells,
    animatedCellCount,
    animationInterval,
    animate,
    cellData,
    Cols,
    Rows,
    containerRef,
    hoveredCells,
    idleAnimatedIndices,
    rng,
    timeoutIds,
  ]);

  const getWaveIntensity = useCallback(
    (distance: number, radius: number, progress: number) => {
      const waveHalfWidth = RIPPLE_WAVE_WIDTH / 2;
      const distanceFromWave = Math.abs(distance - radius);

      if (distanceFromWave > waveHalfWidth) {
        return 0;
      }

      const normalizedDistance = distanceFromWave / waveHalfWidth;
      const waveIntensity = 1 - normalizedDistance ** 2;
      const fadeOut = 1 - progress;

      return waveIntensity * fadeOut;
    },
    []
  );

  const updateCellRippleStyle = useCallback(
    (cellIndex: number, intensity: number) => {
      const selector = `[data-cell-index="${cellIndex}"]`;

      // Check if element exists before animating
      const element = containerRef.current?.querySelector(selector);
      if (!element) {
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
      } else if (hoveredCells.has(cellIndex)) {
        // Restore hover state after ripple passes
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
      } else if (idleAnimatedIndices.has(cellIndex)) {
        // Restore idle state after ripple passes
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
      } else {
        // Spring physics for natural settle back
        animate(
          selector,
          {
            scale: 1,
            backgroundColor: "var(--background)",
            boxShadow: "0 0 0px transparent",
            zIndex: 0,
          },
          {
            type: "spring",
            stiffness: 350,
            damping: 28,
            mass: 0.9,
          }
        );
      }
    },
    [animate, containerRef, hoveredCells, idleAnimatedIndices]
  );

  const animateRipples = useCallback(() => {
    const currentTime = performance.now();
    const currentRipples = ripplesRef.current;

    const activeRipples = currentRipples.filter((ripple) => {
      const elapsed = currentTime - ripple.startTime;
      return elapsed <= waveDuration;
    });

    const hasExpiredRipples = activeRipples.length !== currentRipples.length;

    const limitedRipples = activeRipples.slice(-MAX_CONCURRENT_RIPPLES);

    const affectedCells = new Map<number, number>();

    for (const ripple of limitedRipples) {
      const elapsed = currentTime - ripple.startTime;
      const progress = elapsed / waveDuration;
      const radius = progress * Math.max(Cols, Rows) * RIPPLE_RADIUS_MULTIPLIER;

      const searchRadius = radius + RIPPLE_WAVE_WIDTH;
      const minRow = Math.max(0, Math.floor(ripple.y - searchRadius));
      const maxRow = Math.min(Rows - 1, Math.ceil(ripple.y + searchRadius));
      const minCol = Math.max(0, Math.floor(ripple.x - searchRadius));
      const maxCol = Math.min(Cols - 1, Math.ceil(ripple.x + searchRadius));

      for (let row = minRow; row <= maxRow; row += 1) {
        for (let col = minCol; col <= maxCol; col += 1) {
          const distance = Math.sqrt(
            (col - ripple.x) ** 2 + (row - ripple.y) ** 2
          );

          const intensity = getWaveIntensity(distance, radius, progress);

          if (intensity > 0) {
            const cellIndex = row * Cols + col;
            const existingIntensity = affectedCells.get(cellIndex) || 0;
            if (intensity > existingIntensity) {
              affectedCells.set(cellIndex, intensity);
            }
          }
        }
      }
    }

    for (const [cellIndex, intensity] of affectedCells) {
      updateCellRippleStyle(cellIndex, intensity);
    }

    for (const cellIndex of lastAffectedCells) {
      if (!affectedCells.has(cellIndex)) {
        updateCellRippleStyle(cellIndex, 0);
      }
    }

    lastAffectedCells.clear();
    for (const cellIndex of affectedCells.keys()) {
      lastAffectedCells.add(cellIndex);
    }

    if (limitedRipples.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animateRipples);
    } else {
      isAnimatingRef.current = false;
      lastAffectedCells.clear();
    }

    if (hasExpiredRipples) {
      ripplesRef.current = activeRipples;
    }
  }, [
    Cols,
    Rows,
    waveDuration,
    getWaveIntensity,
    lastAffectedCells,
    updateCellRippleStyle,
  ]);

  const startAnimation = useCallback(() => {
    isAnimatingRef.current = true;
    animationFrameRef.current = requestAnimationFrame(animateRipples);
  }, [animateRipples]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        !document.hidden &&
        ripplesRef.current.length > 0 &&
        !isAnimatingRef.current
      ) {
        startAnimation();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [startAnimation]);

  useEffect(
    () => () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    },
    []
  );

  const handleRipple = useCallback(
    (x: number, y: number) => {
      const currentId = rippleIdRef.current;
      rippleIdRef.current += 1;

      const newRipple = { x, y, startTime: performance.now(), id: currentId };

      if (ripplesRef.current.length >= MAX_CONCURRENT_RIPPLES) {
        ripplesRef.current = [...ripplesRef.current.slice(1), newRipple];
      } else {
        ripplesRef.current = [...ripplesRef.current, newRipple];
      }

      if (!isAnimatingRef.current) {
        startAnimation();
      }
    },
    [startAnimation]
  );

  const throttledHandleRipple = useCallback(
    (x: number, y: number) => {
      if (!isThrottledRef.current) {
        onCellClick?.();
        handleRipple(x, y);
        isThrottledRef.current = true;
        setTimeout(() => {
          isThrottledRef.current = false;
        }, 500);
      }
    },
    [handleRipple, onCellClick]
  );

  const triggerGridRippleFromClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (!containerRef.current) {
        return;
      }

      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target !== containerRef.current &&
        containerRef.current.contains(target)
      ) {
        const cellIndexAttr = target.getAttribute("data-cell-index");
        if (cellIndexAttr) {
          const cellIndex = Number.parseInt(cellIndexAttr, 10);
          const col = cellIndex % Cols;
          const row = Math.floor(cellIndex / Cols);
          throttledHandleRipple(col, row);
          return;
        }
      }

      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const col = Math.min(Math.floor((clickX / rect.width) * Cols), Cols - 1);
      const row = Math.min(Math.floor((clickY / rect.height) * Rows), Rows - 1);

      throttledHandleRipple(col, row);
    },
    [Cols, Rows, throttledHandleRipple, containerRef]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const centerCol = Math.floor(Cols / 2);
        const centerRow = Math.floor(Rows / 2);
        throttledHandleRipple(centerCol, centerRow);
      }
    },
    [Cols, Rows, throttledHandleRipple]
  );

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <section className={cn("size-full bg-border p-px", className)}>
          <button
            aria-label="Interactive grid art with wave effect"
            className="size-full cursor-pointer"
            onClick={triggerGridRippleFromClick}
            onKeyDown={handleKeyDown}
            ref={containerRef}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${Rows}, auto)`,
              gap: "1px",
            }}
            type="button"
          >
            {cellData.map(({ index, row, col }) => (
              <MotionBlockCell
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
      </MotionConfig>
    </LazyMotion>
  );
}
