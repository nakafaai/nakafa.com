"use client";

import { useMediaQuery } from "@mantine/hooks";
import { createSeededRandom } from "@repo/design-system/lib/random";
import { cn } from "@repo/design-system/lib/utils";
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
  ref?: React.Ref<HTMLDivElement>;
}

const DEFAULT_ANIMATION_COLOR = "bg-secondary";
const DEFAULT_ANIMATED_CELL_COUNT = 15;
const DEFAULT_ANIMATION_INTERVAL = 2000;
const DEFAULT_WAVE_DURATION = 2000;
const MAX_CONCURRENT_RIPPLES = 3;
const RIPPLE_RADIUS_MULTIPLIER = 1.5;
const RIPPLE_WAVE_WIDTH = 2;

const BlockCell = memo(function BlockCell({
  index,
  row,
  col,
  ref,
}: BlockCellProps) {
  return (
    <div
      className={cn(
        "size-full bg-background transition-[transform,background-color,box-shadow,color] duration-500 ease-out",
        "hover:bg-primary hover:transition-none"
      )}
      data-cell-index={index}
      data-col={col}
      data-row={row}
      ref={ref}
      style={{
        aspectRatio: "1 / 1",
        contain: "layout style paint",
        willChange: "transform",
      }}
    />
  );
});

export function BlockArt({
  gridCols,
  gridRows,
  className,
  animationColor = DEFAULT_ANIMATION_COLOR,
  animatedCellCount = DEFAULT_ANIMATED_CELL_COUNT,
  animationInterval = DEFAULT_ANIMATION_INTERVAL,
  waveDuration = DEFAULT_WAVE_DURATION,
  onCellClick,
}: BlockArtProps) {
  const isMobile = useMediaQuery("(max-width: 1024px)");

  const Cols = Math.max(1, Math.floor(gridCols ?? (isMobile ? 8 : 18)));
  const Rows = Math.max(1, Math.floor(gridRows ?? (isMobile ? 4 : 8)));
  const totalCells = Cols * Rows;

  const containerRef = useRef<HTMLButtonElement>(null);
  const animationFrameRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);
  const rippleIdRef = useRef(0);
  const rngRef = useRef(createSeededRandom(Cols, Rows, animatedCellCount));
  const cellRefsMap = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const ripplesRef = useRef<Ripple[]>([]);
  const isThrottledRef = useRef(false);
  const lastAffectedCellsRef = useRef<Set<number>>(new Set());
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleAnimatedIndicesRef = useRef<Set<number>>(new Set());

  const cellData = useMemo(() => {
    return Array.from({ length: totalCells }, (_, i) => ({
      index: i,
      row: Math.floor(i / Cols),
      col: i % Cols,
    }));
  }, [totalCells, Cols]);

  useEffect(() => {
    if (totalCells === 0 || animatedCellCount === 0) {
      return;
    }

    const effectiveAnimatedCellCount = Math.max(
      3,
      Math.min(Math.floor(totalCells * 0.12), animatedCellCount)
    );

    const updateIdleAnimation = () => {
      for (const index of idleAnimatedIndicesRef.current) {
        const cell = cellRefsMap.current.get(index);
        if (cell) {
          cell.classList.remove(animationColor);
        }
      }
      idleAnimatedIndicesRef.current.clear();

      const availableIndices = Array.from({ length: totalCells }, (_, i) => i);
      const shuffledIndices = rngRef.current.shuffle(availableIndices);

      for (let i = 0; i < effectiveAnimatedCellCount; i += 1) {
        const index = shuffledIndices[i];
        idleAnimatedIndicesRef.current.add(index);
        const cell = cellRefsMap.current.get(index);
        if (cell) {
          cell.classList.add(animationColor);
        }
      }
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
      for (const index of idleAnimatedIndicesRef.current) {
        const cell = cellRefsMap.current.get(index);
        if (cell) {
          cell.classList.remove(animationColor);
        }
      }
    };
  }, [totalCells, animatedCellCount, animationInterval, animationColor]);

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
      const cell = cellRefsMap.current.get(cellIndex);
      if (!cell) {
        return;
      }

      if (intensity > 0.01) {
        const scale = 1 + intensity * 0.08;
        const colorOpacity = Math.round(intensity * 85);
        const glowBlur = Math.round(6 + intensity * 10);
        const glowOpacity = Math.round(intensity * 50);

        cell.style.transform = `scale(${scale})`;
        cell.style.backgroundColor = `color-mix(in oklch, var(--primary) ${colorOpacity}%, transparent)`;
        cell.style.boxShadow = `0 0 ${glowBlur}px color-mix(in oklch, var(--primary) ${glowOpacity}%, transparent)`;
        cell.style.zIndex = "10";
      } else {
        cell.style.transform = "";
        cell.style.backgroundColor = "";
        cell.style.boxShadow = "";
        cell.style.zIndex = "";
      }
    },
    []
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
    [Cols, Rows, throttledHandleRipple]
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

  const setCellRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      cellRefsMap.current.set(index, el);
    },
    []
  );

  return (
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
          <BlockCell
            col={col}
            index={index}
            key={`${row}-${col}`}
            ref={setCellRef(index)}
            row={row}
          />
        ))}
      </button>
    </section>
  );
}
