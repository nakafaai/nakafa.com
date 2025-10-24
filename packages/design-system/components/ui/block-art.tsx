"use client";

import { createSeededRandom } from "@repo/design-system/lib/random";
import { cn } from "@repo/design-system/lib/utils";
import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Props = {
  gridCols?: number;
  gridRows?: number;
  className?: string;
  animationColor?: string;
  animatedCellCount?: number;
  animationInterval?: number;
  waveColor?: string;
  waveDuration?: number;
  onCellClick?: () => void;
};

type Ripple = {
  x: number;
  y: number;
  startTime: number;
  id: number;
};

const DEFAULT_ANIMATION_COLOR = "bg-secondary";
const DEFAULT_ANIMATED_CELL_COUNT = 15;
const DEFAULT_ANIMATION_INTERVAL = 1000; // ms
const DEFAULT_WAVE_COLOR = "bg-primary";
const DEFAULT_WAVE_DURATION = 2000; // ms
const MAX_CONCURRENT_RIPPLES = 5; // Limit concurrent ripples

// Ripple effect constants
const RIPPLE_RADIUS_MULTIPLIER = 1.5;
const RIPPLE_WAVE_INNER_BOUND = 1.5;
const RIPPLE_WAVE_OUTER_BOUND = 0.5;
const RIPPLE_BASE_OPACITY = 0.8;
const RIPPLE_OPACITY_INTENSITY_FACTOR = 0.2;
const RIPPLE_SCALE_INTENSITY_FACTOR = 0.2;
const RIPPLE_SHADOW_BLUR_FACTOR = 20;
const RIPPLE_SHADOW_COLOR_MIX_FACTOR = 60;

export function BlockArt({
  gridCols = 16,
  gridRows = 8,
  className,
  animationColor = DEFAULT_ANIMATION_COLOR,
  animatedCellCount = DEFAULT_ANIMATED_CELL_COUNT,
  animationInterval = DEFAULT_ANIMATION_INTERVAL,
  waveColor = DEFAULT_WAVE_COLOR,
  waveDuration = DEFAULT_WAVE_DURATION,
  onCellClick,
}: Props) {
  const Cols = Math.max(1, Math.floor(gridCols));
  const Rows = Math.max(1, Math.floor(gridRows));
  const totalCells = Cols * Rows;

  const [activeIndices, setActiveIndices] = useState<Set<number>>(new Set());
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [rippleAffectedCells, setRippleAffectedCells] = useState<
    Map<number, number>
  >(new Map());
  const containerRef = useRef<HTMLButtonElement>(null);
  const animationFrameRef = useRef<number>(0);
  const rippleIdRef = useRef(0);
  const rngRef = useRef(createSeededRandom(Cols, Rows, animatedCellCount));

  useEffect(() => {
    if (totalCells === 0 || animatedCellCount === 0) {
      setActiveIndices(new Set());
      return;
    }

    const effectiveAnimatedCellCount = Math.min(animatedCellCount, totalCells);

    const intervalId = setInterval(() => {
      const newActiveIndices = new Set<number>();
      const availableIndices = Array.from({ length: totalCells }, (_, i) => i);

      const shuffledIndices = rngRef.current.shuffle(availableIndices);

      for (let i = 0; i < effectiveAnimatedCellCount; i++) {
        newActiveIndices.add(shuffledIndices[i]);
      }
      setActiveIndices(newActiveIndices);
    }, animationInterval);

    return () => clearInterval(intervalId);
  }, [totalCells, animatedCellCount, animationInterval]);

  const animateRipples = useCallback(() => {
    const currentTime = performance.now();
    const affectedCells = new Map<number, number>();

    setRipples((prevRipples) => {
      const activeRipples = prevRipples.filter((ripple) => {
        const elapsed = currentTime - ripple.startTime;
        return elapsed <= waveDuration;
      });

      const limitedRipples = activeRipples.slice(-MAX_CONCURRENT_RIPPLES);

      for (const ripple of limitedRipples) {
        const elapsed = currentTime - ripple.startTime;
        const progress = elapsed / waveDuration;
        const radius =
          progress * Math.max(Cols, Rows) * RIPPLE_RADIUS_MULTIPLIER;

        const minRow = Math.max(0, Math.floor(ripple.y - radius - 2));
        const maxRow = Math.min(Rows - 1, Math.ceil(ripple.y + radius + 2));
        const minCol = Math.max(0, Math.floor(ripple.x - radius - 2));
        const maxCol = Math.min(Cols - 1, Math.ceil(ripple.x + radius + 2));

        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            const distance = Math.sqrt(
              (col - ripple.x) ** 2 + (row - ripple.y) ** 2
            );

            if (
              distance >= radius - RIPPLE_WAVE_INNER_BOUND &&
              distance <= radius + RIPPLE_WAVE_OUTER_BOUND
            ) {
              const cellIndex = row * Cols + col;
              const intensity = 1 - Math.abs(distance - radius) / 2;
              const fadeOut = 1 - progress;
              affectedCells.set(
                cellIndex,
                Math.max(affectedCells.get(cellIndex) || 0, intensity * fadeOut)
              );
            }
          }
        }
      }

      return limitedRipples;
    });

    setRippleAffectedCells(affectedCells);

    if (ripples.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animateRipples);
    }
  }, [Cols, Rows, waveDuration, ripples.length]);

  useEffect(() => {
    if (ripples.length > 0) {
      animationFrameRef.current = requestAnimationFrame(animateRipples);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [ripples.length, animateRipples]);

  const handleRipple = useCallback((x: number, y: number) => {
    setRipples((prev) => {
      if (prev.length >= MAX_CONCURRENT_RIPPLES) {
        return [
          ...prev.slice(1),
          { x, y, startTime: performance.now(), id: rippleIdRef.current++ },
        ];
      }
      return [
        ...prev,
        { x, y, startTime: performance.now(), id: rippleIdRef.current++ },
      ];
    });
  }, []);

  const [isThrottled, setIsThrottled] = useState(false);
  const throttleDelay = 500; // ms between ripples

  const throttledHandleRipple = useCallback(
    (x: number, y: number) => {
      if (!isThrottled) {
        onCellClick?.();
        handleRipple(x, y);
        setIsThrottled(true);
        setTimeout(() => setIsThrottled(false), throttleDelay);
      }
    },
    [handleRipple, isThrottled, onCellClick]
  );

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (!containerRef.current) {
        return;
      }

      // Try to find the actual cell that was clicked
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target !== containerRef.current &&
        containerRef.current.contains(target)
      ) {
        // Find the cell index from the DOM
        const cells = Array.from(containerRef.current.children);
        const cellIndex = cells.indexOf(target);

        if (cellIndex >= 0) {
          const col = cellIndex % Cols;
          const row = Math.floor(cellIndex / Cols);
          throttledHandleRipple(col, row);

          return;
        }
      }

      // Fallback to coordinate calculation if direct cell detection fails
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Simple calculation without gap compensation for fallback
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
        {Array.from({ length: totalCells }).map((_, i) => {
          const rippleIntensity = rippleAffectedCells.get(i) || 0;
          const isActive = activeIndices.has(i);
          const row = Math.floor(i / Cols);
          const col = i % Cols;

          function getCellColor() {
            if (rippleIntensity > 0) {
              return waveColor;
            }
            if (isActive) {
              return animationColor;
            }
            return "bg-background";
          }

          return (
            <div
              className={cn(
                "size-full transition-all duration-300 ease-out",
                getCellColor(),
                "hover:bg-primary"
              )}
              key={`${row}-${col}`}
              style={{
                aspectRatio: "1 / 1",
                opacity:
                  rippleIntensity > 0
                    ? RIPPLE_BASE_OPACITY +
                      RIPPLE_OPACITY_INTENSITY_FACTOR * rippleIntensity
                    : 1,
                transform:
                  rippleIntensity > 0
                    ? `scale(${1 + rippleIntensity * RIPPLE_SCALE_INTENSITY_FACTOR})`
                    : undefined,
                boxShadow:
                  rippleIntensity > 0
                    ? `0 0 ${RIPPLE_SHADOW_BLUR_FACTOR * rippleIntensity}px color-mix(in oklch, var(--primary) ${RIPPLE_SHADOW_COLOR_MIX_FACTOR * rippleIntensity}%, transparent)`
                    : undefined,
                transition:
                  rippleIntensity > 0
                    ? "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                    : undefined,
              }}
            />
          );
        })}
      </button>
    </section>
  );
}
