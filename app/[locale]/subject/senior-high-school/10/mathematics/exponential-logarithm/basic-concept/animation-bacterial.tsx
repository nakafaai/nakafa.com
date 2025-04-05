"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PauseIcon, PlayIcon, TimerResetIcon } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useIntersectionObserver } from "usehooks-ts";

type BacterialGrowthProps = {
  initialCount?: number;
  maxGenerations?: number;
  labels?: {
    title?: string;
    bacterial?: string;
    initialBacteria?: string;
  };
};

export default function BacterialGrowth({
  initialCount = 1,
  maxGenerations = 6,
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

  const { ref, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
  });

  // Start playing when component comes into view
  useEffect(() => {
    if (isIntersecting) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [isIntersecting]);

  // Calculate current bacteria count based on the formula B(t) = B₀ × 2^t
  const bacteriaCount = useMemo(
    () => initialCount * 2 ** deferredGeneration,
    [initialCount, deferredGeneration]
  );

  // Create an array of bacteria to display
  const bacteria = useMemo(
    () => Array.from({ length: Math.min(bacteriaCount, 100) }, (_, i) => i),
    [bacteriaCount]
  );

  // Calculate how many bacteria to actually show (cap at 100 for performance)
  const displayCount = useMemo(
    () => Math.min(bacteriaCount, 100),
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>
          {displayCount} {labels.bacterial}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div
          ref={ref}
          className="relative aspect-square w-full overflow-hidden rounded-lg border border-cyan-100 bg-cyan-50 sm:aspect-video dark:border-cyan-900 dark:bg-cyan-950"
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
                    key={id}
                    layout
                    className="relative flex items-center justify-center"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                    }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                      delay: id * 0.01, // Stagger effect
                    }}
                  >
                    <motion.div
                      className="aspect-square h-full max-h-[20px] w-full max-w-[20px] rounded-full bg-cyan-300 transition-colors hover:bg-cyan-400 sm:max-h-[32px] sm:max-w-[32px] dark:bg-cyan-500"
                      animate={{
                        scale: [1, 1.1, 1],
                      }}
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
              variant="outline"
              aria-label="Reset"
              onClick={resetAnimation}
              size="icon"
            >
              <TimerResetIcon className="size-4 shrink-0" />
              <span className="sr-only">Reset</span>
            </Button>
            <Button
              variant={isPlaying ? "outline" : "default"}
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlayPause}
              size="icon"
            >
              {isPlaying ? (
                <PauseIcon className="size-4 shrink-0" />
              ) : (
                <PlayIcon className="size-4 shrink-0" />
              )}
              <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
            </Button>
          </div>

          <div className="flex gap-2">
            {[0.25, 0.5, 1, 1.5, 2].map((speedValue) => (
              <Button
                key={speedValue}
                variant={speed === speedValue ? "default" : "outline"}
                size="sm"
                onClick={() => setSpeed(speedValue)}
              >
                {speedValue}x
              </Button>
            ))}
          </div>
        </div>

        <div className="w-full border-t px-6 pt-4">
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: maxGenerations + 1 }).map((_, i) => (
              <Button
                key={i}
                variant={generation === i ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setGeneration(i);
                  setIsPlaying(false);
                }}
              >
                {i}h
              </Button>
            ))}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
