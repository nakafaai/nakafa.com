"use client";

import { Clock04Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { useIntersection, useMediaQuery } from "@mantine/hooks";
import { getTableChairArrangement } from "@repo/contents/material/lesson/mathematics/sequence-series/sequence-concept/animation-table-arrangement";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  AnimatePresence,
  domMax,
  LayoutGroup,
  LazyMotion,
  MotionConfig,
} from "motion/react";
import { div as MotionDiv } from "motion/react-m";
import {
  type ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

const MAX_TABLES_MOBILE = 2;
const MAX_TABLES_DESKTOP = 3;
const ANIMATION_INTERVAL_MS = 2000;
const STAGGER_DELAY = 0.01;
const SPEED_HALF = 0.5;
const SPEED_NORMAL = 1;
const SPEED_FAST = 1.5;
const SPEED_VERY_FAST = 2;
const SPEED_VALUES = [SPEED_HALF, SPEED_NORMAL, SPEED_FAST, SPEED_VERY_FAST];
const Z_INDEX_TABLE = 10;
const Z_INDEX_CHAIR = 20;

interface TableChairsProps {
  labels: {
    title: ReactNode;
    table: string;
    chair: string;
    reset: string;
    pause: string;
    play: string;
    setSpeed: string;
    setTableCount: string;
  };
}

/**
 * Renders the table-chair sequence animation used by the sequence concept page.
 *
 * `LazyMotion` with `domMax` keeps layout animation support explicit, while
 * `MotionConfig reducedMotion="user"` follows the user's OS preference.
 *
 * @see https://motion.dev/docs/react-reduce-bundle-size
 * @see https://motion.dev/docs/react-accessibility
 * @see https://motion.dev/docs/react-layout-animations
 */
export default function TableChairsAnimation({ labels }: TableChairsProps) {
  const [tableCount, setTableCount] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);

  const { ref, entry } = useIntersection({
    threshold: 0.1,
  });

  const isInView = entry?.isIntersecting ?? false;
  // Viewport visibility gates work without overriding the user's Play/Pause intent.
  const isAnimating = isPlaying && isInView;
  const deferredAnimating = useDeferredValue(isAnimating);
  const deferredTableCount = useDeferredValue(tableCount);

  const isMobile = useMediaQuery("(max-width: 640px)");

  const maxTables = isMobile ? MAX_TABLES_MOBILE : MAX_TABLES_DESKTOP;

  // Calculate chair count based on the formula U_n = 2n + 2
  const chairCount = 2 * deferredTableCount + 2;

  useEffect(() => {
    // Stop playing when maximum table count is reached
    if (deferredTableCount >= maxTables) {
      setIsPlaying(false);
      return;
    }

    if (!deferredAnimating) {
      return;
    }

    const interval = setInterval(() => {
      setTableCount((prev) => {
        if (prev < maxTables) {
          return prev + 1;
        }
        return prev;
      });
    }, ANIMATION_INTERVAL_MS / speed);

    return () => clearInterval(interval);
  }, [deferredAnimating, deferredTableCount, maxTables, speed]);

  const resetAnimation = useCallback(() => {
    setTableCount(1);
    setIsPlaying(true);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!isPlaying && tableCount >= maxTables) {
      // If at max table count and trying to play, restart from beginning
      setTableCount(1);
      setIsPlaying(true);
      return;
    }

    setIsPlaying(!isPlaying);
  }, [isPlaying, tableCount, maxTables]);

  const arrangement = useMemo(
    () => getTableChairArrangement(deferredTableCount),
    [deferredTableCount]
  );

  return (
    <Card className="content-auto-card" ref={ref}>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>
          {deferredTableCount} {labels.table} & {chairCount} {labels.chair}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-cyan-100 bg-cyan-50 p-4 sm:aspect-video dark:border-cyan-900 dark:bg-cyan-950">
          <div className="flex h-full flex-col items-center justify-center gap-8">
            {/* Table and chairs visualization */}
            <div className="relative flex w-full items-center justify-center">
              <div
                className="relative"
                style={{
                  width: arrangement.width,
                  height: arrangement.height,
                }}
              >
                <MotionConfig reducedMotion="user">
                  <LazyMotion features={domMax} strict>
                    <LayoutGroup>
                      {/* Tables */}
                      <AnimatePresence mode="popLayout">
                        {arrangement.tables.map((table) => (
                          <MotionDiv
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute rounded-md bg-teal-300 shadow-sm transition-colors hover:bg-teal-400 dark:bg-teal-500"
                            exit={{ opacity: 0, scale: 0.95 }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            key={`table-${table.id}`}
                            layout
                            style={{
                              left: table.x,
                              top: table.y,
                              width: table.width,
                              height: table.height,
                              zIndex: Z_INDEX_TABLE,
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 30,
                              delay: (table.id - 1) * STAGGER_DELAY, // Stagger effect
                            }}
                          />
                        ))}
                      </AnimatePresence>

                      {/* Chairs */}
                      <AnimatePresence mode="popLayout">
                        {arrangement.chairs.map((chair) => (
                          <MotionDiv
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute rounded-full bg-cyan-300 shadow-sm transition-colors hover:bg-cyan-400 dark:bg-cyan-500"
                            exit={{ opacity: 0, scale: 0.95 }}
                            initial={{ opacity: 0, scale: 0.95 }}
                            key={`chair-${chair.id}`}
                            layout
                            style={{
                              left: chair.x,
                              top: chair.y,
                              width: arrangement.chairSize,
                              height: arrangement.chairSize,
                              zIndex: Z_INDEX_CHAIR,
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 500,
                              damping: 30,
                              delay: chair.id * STAGGER_DELAY, // Stagger effect
                            }}
                          />
                        ))}
                      </AnimatePresence>
                    </LayoutGroup>
                  </LazyMotion>
                </MotionConfig>
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 px-0">
        <div className="flex w-full flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex justify-between gap-2">
            <Button
              aria-label={labels.reset}
              onClick={resetAnimation}
              size="icon"
              variant="outline"
            >
              <HugeIcons icon={Clock04Icon} />
              <span className="sr-only">{labels.reset}</span>
            </Button>
            <Button
              aria-label={isPlaying ? labels.pause : labels.play}
              onClick={togglePlayPause}
              size="icon"
              variant={isPlaying ? "outline" : "default"}
            >
              <HugeIcons icon={isPlaying ? PauseIcon : PlayIcon} />
              <span className="sr-only">
                {isPlaying ? labels.pause : labels.play}
              </span>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {SPEED_VALUES.map((speedValue) => (
              <Button
                aria-label={`${labels.setSpeed} ${speedValue}x`}
                key={speedValue}
                onClick={() => setSpeed(speedValue)}
                size="sm"
                variant={speed === speedValue ? "default" : "outline"}
              >
                {speedValue}x
              </Button>
            ))}
          </div>
        </div>

        <div className="w-full border-t px-6 pt-4">
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: maxTables }, (_, index) => index + 1).map(
              (count) => (
                <Button
                  aria-label={`${labels.setTableCount} ${count}`}
                  key={`table-count-${count}`}
                  onClick={() => {
                    setTableCount(count);
                    setIsPlaying(false);
                  }}
                  size="sm"
                  variant={tableCount === count ? "default" : "outline"}
                >
                  {count} {labels.table}
                </Button>
              )
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
