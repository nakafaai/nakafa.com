"use client";

import { Clock04Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { useIntersection } from "@mantine/hooks";
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
import * as m from "motion/react-m";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

const MAX_BACTERIA_COUNT = 100;
const SPEED_INTERVAL = 1000;
const STAGGER_DELAY = 0.01;
const SCALE_INCREASE = 1.1;
const SPEED_VALUES_DIFFERENCE = 0.25;
const SPEED_VALUES = Array.from(
  { length: 5 },
  (_, i) => SPEED_VALUES_DIFFERENCE * (i + 1)
);

type FormulaType = "geometric" | "exponential" | "custom";

interface BacterialGrowthProps {
  /**
   * The custom formula to use.
   */
  customFormula?: (
    initialCount: number,
    ratio: number,
    generation: number
  ) => number;
  /**
   * The type of formula to use.
   * @default "geometric"
   */
  formulaType?: FormulaType;
  /**
   * The initial count of bacteria.
   * @default 1
   */
  initialCount?: number;
  /**
   * The labels to use for the animation.
   */
  labels?: {
    title?: string;
    bacterial?: string;
    initialBacteria?: string;
  };
  /**
   * The maximum number of generations to display.
   * @default 6
   */
  maxGenerations?: number;
  /**
   * The ratio of bacterial growth.
   * @default 2
   */
  ratio?: number;
  /**
   * The time interval in hours.
   * @default 1
   */
  timeInterval?: number;
  /**
   * The time unit label (hours, minutes, etc.).
   * @default "h"
   */
  timeUnit?: string;
}

/**
 * Renders a bounded bacterial-growth animation for exponential-growth lessons.
 *
 * `LazyMotion` with `domMax` keeps the layout/popLayout feature bundle explicit,
 * while `MotionConfig reducedMotion="user"` follows the user's OS preference.
 *
 * @see https://motion.dev/docs/react-reduce-bundle-size
 * @see https://motion.dev/docs/react-accessibility
 * @see https://motion.dev/docs/react-animate-presence#poplayout
 */
export function BacterialGrowth({
  ratio = 2,
  initialCount = 1,
  maxGenerations = 6,
  formulaType = "geometric",
  customFormula,
  timeInterval = 1, // Default: 1 hour
  timeUnit = "h", // Default: hours
  labels = {
    title: "Bacterial Growth",
    bacterial: "Bacterial",
    initialBacteria: "Initial bacteria",
  },
}: BacterialGrowthProps) {
  const [generation, setGeneration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);

  const { ref, entry } = useIntersection({
    threshold: 0.1,
  });

  const isInView = entry?.isIntersecting ?? false;
  // Viewport visibility gates work without overriding the user's Play/Pause intent.
  const isAnimating = isPlaying && isInView;
  const deferredAnimating = useDeferredValue(isAnimating);
  const deferredGeneration = useDeferredValue(generation);
  const pulseRepeat = deferredAnimating ? Number.POSITIVE_INFINITY : 0;

  // Calculate current bacteria count based on the selected formula type
  const bacteriaCount = useMemo(() => {
    if (customFormula) {
      return customFormula(initialCount, ratio, deferredGeneration);
    }

    switch (formulaType) {
      case "geometric":
        // U_n = a·r^(n-1) (standard geometric sequence formula)
        // For bacterial growth: bacteria after n generations = initial × ratio^(generation)
        // We always start index from 0, so we don't need to subtract 1 from the generation
        return initialCount * ratio ** deferredGeneration;
      case "exponential":
        // B(t) = B₀ × e^(kt) where k = ln(ratio)
        return initialCount * Math.exp(Math.log(ratio) * deferredGeneration);
      default:
        // Default to geometric for backward compatibility
        return initialCount * ratio ** deferredGeneration;
    }
  }, [initialCount, deferredGeneration, ratio, formulaType, customFormula]);

  // Create an array of bacteria to display
  const bacteria = useMemo(
    () =>
      Array.from(
        { length: Math.min(Math.round(bacteriaCount), MAX_BACTERIA_COUNT) },
        (_, i) => i
      ),
    [bacteriaCount]
  );

  // Calculate how many bacteria to actually show (cap at 100 for performance)
  const displayCount = useMemo(
    () => Math.min(Math.round(bacteriaCount), MAX_BACTERIA_COUNT),
    [bacteriaCount]
  );

  // Calculate grid dimensions based on bacteria count
  const gridCols = useMemo(
    () => Math.min(Math.ceil(Math.sqrt(displayCount)), 10),
    [displayCount]
  );

  useEffect(() => {
    // Stop playing when maximum generation is reached
    if (deferredGeneration >= maxGenerations) {
      setIsPlaying(false);
      return;
    }

    if (!deferredAnimating) {
      return;
    }

    const interval = setInterval(() => {
      setGeneration((prev) => {
        if (prev < maxGenerations) {
          return prev + 1;
        }
        return prev;
      });
    }, SPEED_INTERVAL / speed);

    return () => clearInterval(interval);
  }, [deferredAnimating, deferredGeneration, maxGenerations, speed]);

  const resetAnimation = useCallback(() => {
    setGeneration(0);
    setIsPlaying(true);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!isPlaying && generation >= maxGenerations) {
      // If at max generation and trying to play, restart from beginning
      setGeneration(0);
      setIsPlaying(true);
      return;
    }

    setIsPlaying(!isPlaying);
  }, [isPlaying, generation, maxGenerations]);

  // Generate time buttons
  const timeButtons = useMemo(
    () =>
      Array.from({ length: maxGenerations + 1 }).map((_, i) => {
        const time = i * timeInterval;
        return (
          <Button
            key={time.toString()}
            onClick={() => {
              setGeneration(i);
              setIsPlaying(false);
            }}
            size="sm"
            variant={generation === i ? "default" : "outline"}
          >
            {time}
            {timeUnit}
          </Button>
        );
      }),
    [generation, maxGenerations, timeInterval, timeUnit]
  );

  return (
    <Card className="content-auto-card" ref={ref}>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>
          {Math.round(bacteriaCount)} {labels.bacterial}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-secondary/10 sm:aspect-video">
          <div
            className="relative grid h-full w-full gap-0.5 p-2 sm:px-0"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            }}
          >
            <MotionConfig reducedMotion="user">
              <LazyMotion features={domMax} strict>
                <LayoutGroup>
                  <AnimatePresence mode="popLayout">
                    {bacteria.map((id) => (
                      <m.div
                        animate={{
                          scale: 1,
                          opacity: 1,
                        }}
                        className="relative flex items-center justify-center"
                        exit={{ scale: 0, opacity: 0 }}
                        initial={{ scale: 0, opacity: 0 }}
                        key={id}
                        layout
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                          delay: id * STAGGER_DELAY, // Stagger effect
                        }}
                      >
                        <m.div
                          animate={{
                            scale: deferredAnimating
                              ? [1, SCALE_INCREASE, 1]
                              : 1,
                          }}
                          className="aspect-square h-full max-h-5 w-full max-w-5 rounded-full bg-secondary/90 transition-colors hover:bg-secondary sm:max-h-8 sm:max-w-8"
                          transition={{
                            duration: 1,
                            repeat: pulseRepeat,
                            repeatType: "reverse",
                          }}
                          whileHover={{
                            scale: SCALE_INCREASE,
                          }}
                        />
                      </m.div>
                    ))}
                  </AnimatePresence>
                </LayoutGroup>
              </LazyMotion>
            </MotionConfig>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 px-0">
        <div className="flex w-full flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex justify-between gap-2">
            <Button
              aria-label="Reset"
              onClick={resetAnimation}
              size="icon"
              variant="outline"
            >
              <HugeIcons icon={Clock04Icon} />
              <span className="sr-only">Reset</span>
            </Button>
            <Button
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlayPause}
              size="icon"
              variant={isPlaying ? "outline" : "default"}
            >
              <HugeIcons icon={isPlaying ? PauseIcon : PlayIcon} />
              <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {SPEED_VALUES.map((speedValue) => (
              <Button
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
            {timeButtons}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
