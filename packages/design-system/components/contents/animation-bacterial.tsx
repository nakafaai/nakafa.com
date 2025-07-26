"use client";

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
import { PauseIcon, PlayIcon, TimerResetIcon } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

type FormulaType = "geometric" | "exponential" | "custom";

type BacterialGrowthProps = {
  /**
   * The ratio of bacterial growth.
   * @default 2
   */
  ratio?: number;
  /**
   * The initial count of bacteria.
   * @default 1
   */
  initialCount?: number;
  /**
   * The maximum number of generations to display.
   * @default 6
   */
  maxGenerations?: number;
  /**
   * The type of formula to use.
   * @default "geometric"
   */
  formulaType?: FormulaType;
  /**
   * The custom formula to use.
   */
  customFormula?: (
    initialCount: number,
    ratio: number,
    generation: number
  ) => number;
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
  /**
   * The labels to use for the animation.
   */
  labels?: {
    title?: string;
    bacterial?: string;
    initialBacteria?: string;
  };
};

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
  const [isPlaying, setIsPlaying] = useState(false);

  const deferredPlaying = useDeferredValue(isPlaying);
  const deferredGeneration = useDeferredValue(generation);

  const { ref, entry } = useIntersection({
    threshold: 0.1,
  });

  useEffect(() => {
    if (entry) {
      setIsPlaying(entry.isIntersecting);
    }
  }, [entry]);

  // Start playing when component comes into view

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
        { length: Math.min(Math.round(bacteriaCount), 100) },
        (_, i) => i
      ),
    [bacteriaCount]
  );

  // Calculate how many bacteria to actually show (cap at 100 for performance)
  const displayCount = useMemo(
    () => Math.min(Math.round(bacteriaCount), 100),
    [bacteriaCount]
  );

  // Calculate grid dimensions based on bacteria count
  const gridCols = useMemo(
    () => Math.min(Math.ceil(Math.sqrt(displayCount)), 10),
    [displayCount]
  );

  useEffect(() => {
    let interval: NodeJS.Timeout;

    // Stop playing when maximum generation is reached
    if (deferredGeneration >= maxGenerations) {
      setIsPlaying(false);
      return;
    }

    if (deferredPlaying) {
      interval = setInterval(() => {
        setGeneration((prev) => {
          if (prev < maxGenerations) {
            return prev + 1;
          }
          return prev;
        });
      }, 1000 / speed);
    }

    return () => clearInterval(interval);
  }, [deferredPlaying, deferredGeneration, maxGenerations, speed]);

  const resetAnimation = useCallback(() => {
    setGeneration(0);
    setIsPlaying(true);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!isPlaying && generation >= maxGenerations) {
      // If at max generation and trying to play, restart from beginning
      setGeneration(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying, generation, maxGenerations]);

  // Generate time buttons
  const timeButtons = useMemo(() => {
    return Array.from({ length: maxGenerations + 1 }).map((_, i) => {
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
    });
  }, [generation, maxGenerations, timeInterval, timeUnit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>
          {Math.round(bacteriaCount)} {labels.bacterial}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div
          className="relative aspect-square w-full overflow-hidden rounded-lg border border-cyan-100 bg-cyan-50 sm:aspect-video dark:border-cyan-900 dark:bg-cyan-950"
          ref={ref}
        >
          <div
            className="grid h-full w-full gap-0.5 p-2 sm:px-0"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            }}
          >
            <LayoutGroup>
              <AnimatePresence mode="popLayout">
                {bacteria.map((id) => (
                  <motion.div
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
                      delay: id * 0.01, // Stagger effect
                    }}
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.1, 1],
                      }}
                      className="aspect-square h-full max-h-[20px] w-full max-w-[20px] rounded-full bg-cyan-300 transition-colors hover:bg-cyan-400 sm:max-h-[32px] sm:max-w-[32px] dark:bg-cyan-500"
                      transition={{
                        duration: 1,
                        repeat: Number.POSITIVE_INFINITY,
                        repeatType: "reverse",
                      }}
                      whileHover={{
                        scale: 1.2,
                      }}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </LayoutGroup>
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
              <TimerResetIcon className="size-4 shrink-0" />
              <span className="sr-only">Reset</span>
            </Button>
            <Button
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlayPause}
              size="icon"
              variant={isPlaying ? "outline" : "default"}
            >
              {isPlaying ? (
                <PauseIcon className="size-4 shrink-0" />
              ) : (
                <PlayIcon className="size-4 shrink-0" />
              )}
              <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {[0.25, 0.5, 1, 1.5, 2].map((speedValue) => (
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
