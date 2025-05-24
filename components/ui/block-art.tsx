"use client";

import { cn } from "@/lib/utils";
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

export function BlockArt({
  gridCols = 16,
  gridRows = 8,
  className,
  animationColor = DEFAULT_ANIMATION_COLOR,
  animatedCellCount = DEFAULT_ANIMATED_CELL_COUNT,
  animationInterval = DEFAULT_ANIMATION_INTERVAL,
  waveColor = DEFAULT_WAVE_COLOR,
  waveDuration = DEFAULT_WAVE_DURATION,
}: Props) {
  const COLS = Math.max(1, Math.floor(gridCols));
  const ROWS = Math.max(1, Math.floor(gridRows));
  const totalCells = COLS * ROWS;

  const [activeIndices, setActiveIndices] = useState<Set<number>>(new Set());
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [rippleAffectedCells, setRippleAffectedCells] = useState<
    Map<number, number>
  >(new Map());
  const containerRef = useRef<HTMLButtonElement>(null);
  const animationFrameRef = useRef<number>(0);
  const rippleIdRef = useRef(0);

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

  const animateRipples = useCallback(() => {
    const currentTime = Date.now();
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
        const radius = progress * Math.max(COLS, ROWS) * 1.5;

        const minRow = Math.max(0, Math.floor(ripple.y - radius - 2));
        const maxRow = Math.min(ROWS - 1, Math.ceil(ripple.y + radius + 2));
        const minCol = Math.max(0, Math.floor(ripple.x - radius - 2));
        const maxCol = Math.min(COLS - 1, Math.ceil(ripple.x + radius + 2));

        for (let row = minRow; row <= maxRow; row++) {
          for (let col = minCol; col <= maxCol; col++) {
            const distance = Math.sqrt(
              (col - ripple.x) ** 2 + (row - ripple.y) ** 2
            );

            if (distance >= radius - 1.5 && distance <= radius + 0.5) {
              const cellIndex = row * COLS + col;
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
  }, [COLS, ROWS, waveDuration, ripples.length]);

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
          { x, y, startTime: Date.now(), id: rippleIdRef.current++ },
        ];
      }
      return [
        ...prev,
        { x, y, startTime: Date.now(), id: rippleIdRef.current++ },
      ];
    });
  }, []);

  const [isThrottled, setIsThrottled] = useState(false);
  const throttleDelay = 500; // ms between ripples

  const throttledHandleRipple = useCallback(
    (x: number, y: number) => {
      if (!isThrottled) {
        handleRipple(x, y);
        setIsThrottled(true);
        setTimeout(() => setIsThrottled(false), throttleDelay);
      }
    },
    [handleRipple, isThrottled]
  );

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (!containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cellWidth = rect.width / COLS;
      const cellHeight = rect.height / ROWS;

      const col = Math.floor(x / cellWidth);
      const row = Math.floor(y / cellHeight);

      throttledHandleRipple(col, row);
    },
    [COLS, ROWS, throttledHandleRipple]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const centerCol = Math.floor(COLS / 2);
        const centerRow = Math.floor(ROWS / 2);

        throttledHandleRipple(centerCol, centerRow);
      }
    },
    [COLS, ROWS, throttledHandleRipple]
  );

  return (
    <section
      className={cn("h-full w-full bg-border pt-px lg:py-px", className)}
    >
      <button
        type="button"
        ref={containerRef}
        className="h-full w-full cursor-pointer"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label="Interactive grid art with wave effect"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, auto)`,
          gap: "1px",
        }}
      >
        {Array.from({ length: totalCells }).map((_, i) => {
          const rippleIntensity = rippleAffectedCells.get(i) || 0;
          const isActive = activeIndices.has(i);

          const getCellColor = () => {
            if (rippleIntensity > 0) {
              return waveColor;
            }
            if (isActive) {
              return animationColor;
            }
            return "bg-background";
          };

          return (
            <div
              key={i}
              className={cn(
                "transition-all duration-300 ease-out",
                getCellColor(),
                "hover:bg-primary"
              )}
              style={{
                aspectRatio: "1 / 1",
                opacity: rippleIntensity > 0 ? 0.8 + 0.2 * rippleIntensity : 1,
                transform:
                  rippleIntensity > 0
                    ? `scale(${1 + rippleIntensity * 0.2})`
                    : undefined,
                boxShadow:
                  rippleIntensity > 0
                    ? `0 0 ${20 * rippleIntensity}px color-mix(in oklch, var(--primary) ${60 * rippleIntensity}%, transparent)`
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
