"use client";

import { useMediaQuery } from "@mantine/hooks";
import { createSeededRandom } from "@repo/design-system/lib/random";
import { cn } from "@repo/design-system/lib/utils";
import { MotionConfig, motion, useAnimate } from "motion/react";
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
  gridCols?: number;
  gridRows?: number;
  className?: string;
  animationColor?: string;
  animatedCellCount?: number;
  animationInterval?: number;
  waveDuration?: number;
  onCellClick?: () => void;
}

interface Ripple {
  x: number;
  y: number;
  startTime: number;
  id: number;
}

interface BlockCellProps {
  index: number;
  row: number;
  col: number;
  onHoverStart: (index: number) => void;
  onHoverEnd: (index: number) => void;
}

const DEFAULT_ANIMATED_CELL_COUNT = 15;
const DEFAULT_ANIMATION_INTERVAL = 2000;
const DEFAULT_WAVE_DURATION = 2000;
const MAX_CONCURRENT_RIPPLES = 3;
const RIPPLE_RADIUS_MULTIPLIER = 1.5;
const RIPPLE_WAVE_WIDTH = 2;

const MotionBlockCell = memo(function MotionBlockCell({
  index,
  row,
  col,
  onHoverStart,
  onHoverEnd,
}: BlockCellProps) {
  return (
    <motion.div
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
  const isLaptop = useMediaQuery("(min-width: 1024px)");
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  const getDefaultCols = () => {
    if (isDesktop) {
      return 18;
    }
    if (isLaptop) {
      return 16;
    }
    return 8;
  };

  const getDefaultRows = () => {
    if (isDesktop) {
      return 8;
    }
    if (isLaptop) {
      return 7;
    }
    return 4;
  };

  const Cols = Math.max(1, Math.floor(gridCols ?? getDefaultCols()));
  const Rows = Math.max(1, Math.floor(gridRows ?? getDefaultRows()));
  const totalCells = Cols * Rows;

  const [containerRef, animate] = useAnimate<HTMLButtonElement>();
  const animationFrameRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);
  const rippleIdRef = useRef(0);
  const rngRef = useRef(createSeededRandom(Cols, Rows, animatedCellCount));
  const ripplesRef = useRef<Ripple[]>([]);
  const isThrottledRef = useRef(false);
  const lastAffectedCellsRef = useRef<Set<number>>(new Set());
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleAnimatedIndicesRef = useRef<Set<number>>(new Set());
  const hoveredCellsRef = useRef<Set<number>>(new Set());
  const timeoutIdsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const cellData = useMemo(() => {
    return Array.from({ length: totalCells }, (_, i) => ({
      index: i,
      row: Math.floor(i / Cols),
      col: i % Cols,
    }));
  }, [totalCells, Cols]);

  // Handle hover start with instant color change
  const handleHoverStart = useCallback(
    (index: number) => {
      hoveredCellsRef.current.add(index);
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
    [animate, containerRef]
  );

  // Handle hover end with trail effect
  const handleHoverEnd = useCallback(
    (index: number) => {
      hoveredCellsRef.current.delete(index);
      const selector = `[data-cell-index="${index}"]`;

      // Check if element exists before animating
      const element = containerRef.current?.querySelector(selector);
      if (!element) {
        return;
      }

      // If cell is in idle animation, restore to secondary color
      if (idleAnimatedIndicesRef.current.has(index)) {
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
    [animate, containerRef]
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
    idleAnimatedIndicesRef.current.clear();
    hoveredCellsRef.current.clear();

    const effectiveAnimatedCellCount = Math.max(
      3,
      Math.min(Math.floor(totalCells * 0.12), animatedCellCount)
    );

    const centerCol = Math.floor(Cols / 2);
    const centerRow = Math.floor(Rows / 2);

    const updateIdleAnimation = () => {
      // Clear any pending timeouts from previous animation cycle
      for (const timeoutId of timeoutIdsRef.current) {
        clearTimeout(timeoutId);
      }
      timeoutIdsRef.current.clear();

      // Fade out previous animations with stagger
      const prevIndices = Array.from(idleAnimatedIndicesRef.current);
      for (const index of prevIndices) {
        // Skip if currently hovered
        if (hoveredCellsRef.current.has(index)) {
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
          if (hoveredCellsRef.current.has(index)) {
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
        timeoutIdsRef.current.add(timeoutId);
      }
      idleAnimatedIndicesRef.current.clear();

      // Select new cells and animate with stagger from center
      const availableIndices = Array.from({ length: totalCells }, (_, i) => i);
      const shuffledIndices = rngRef.current.shuffle(availableIndices);
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
        if (hoveredCellsRef.current.has(index)) {
          return;
        }

        const cell = cellData[index];
        const distanceFromCenter = Math.sqrt(
          (cell.col - centerCol) ** 2 + (cell.row - centerRow) ** 2
        );

        idleAnimatedIndicesRef.current.add(index);
        const selector = `[data-cell-index="${index}"]`;

        // Stagger delay based on distance from center
        const timeoutId = setTimeout(
          () => {
            // Re-check hover state before animating
            if (hoveredCellsRef.current.has(index)) {
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
        timeoutIdsRef.current.add(timeoutId);
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
      for (const timeoutId of timeoutIdsRef.current) {
        clearTimeout(timeoutId);
      }
      timeoutIdsRef.current.clear();
      // Reset all idle animated cells
      for (const index of idleAnimatedIndicesRef.current) {
        if (hoveredCellsRef.current.has(index)) {
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
      idleAnimatedIndicesRef.current.clear();
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
      } else if (hoveredCellsRef.current.has(cellIndex)) {
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
      } else if (idleAnimatedIndicesRef.current.has(cellIndex)) {
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
    [animate, containerRef]
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

    for (const cellIndex of lastAffectedCellsRef.current) {
      if (!affectedCells.has(cellIndex)) {
        updateCellRippleStyle(cellIndex, 0);
      }
    }

    lastAffectedCellsRef.current = new Set(affectedCells.keys());

    if (limitedRipples.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animateRipples);
    } else {
      isAnimatingRef.current = false;
      lastAffectedCellsRef.current.clear();
    }

    if (hasExpiredRipples) {
      ripplesRef.current = activeRipples;
    }
  }, [Cols, Rows, waveDuration, getWaveIntensity, updateCellRippleStyle]);

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

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

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

  const handleClick = useCallback(
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
    <MotionConfig reducedMotion="user">
      <section className={cn("size-full bg-border p-px", className)}>
        <button
          aria-label="Interactive grid art with wave effect"
          className="size-full cursor-pointer"
          onClick={handleClick}
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
  );
}
