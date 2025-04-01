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
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

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
  const [isPlaying, setIsPlaying] = useState(true);

  // Calculate current bacteria count based on the formula B(t) = B₀ × 2^t
  const bacteriaCount = initialCount * 2 ** generation;

  // Create an array of bacteria to display
  const bacteria = Array.from(
    { length: Math.min(bacteriaCount, 100) },
    (_, i) => i
  );

  // Calculate how many bacteria to actually show (cap at 100 for performance)
  const displayCount = Math.min(bacteriaCount, 100);

  // Calculate grid dimensions based on bacteria count
  const gridCols = Math.min(Math.ceil(Math.sqrt(displayCount)), 10);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isPlaying && generation < maxGenerations) {
      interval = setInterval(() => {
        setGeneration((prev) => {
          if (prev < maxGenerations) {
            return prev + 1;
          }
          setIsPlaying(false);
          return prev;
        });
      }, 2000 / speed);
    }

    return () => clearInterval(interval);
  }, [isPlaying, generation, maxGenerations, speed]);

  const resetAnimation = useCallback(() => {
    setGeneration(0);
    setIsPlaying(true);
  }, []);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>
          {displayCount} {labels.bacterial}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-cyan-100 bg-cyan-50 sm:aspect-video dark:border-cyan-900 dark:bg-cyan-950">
          <div
            className="grid h-full w-full gap-0.5 p-2 sm:px-0"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            }}
          >
            <AnimatePresence mode="popLayout">
              {bacteria.map((id) => (
                <motion.div
                  key={id}
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
                  layout
                >
                  <motion.div
                    className="aspect-square h-full max-h-[20px] w-full max-w-[20px] rounded-full bg-cyan-300 sm:max-h-[32px] sm:max-w-[32px] dark:bg-cyan-500"
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
                      backgroundColor: "var(--color-cyan-400)",
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 px-0">
        <div className="flex w-full flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={resetAnimation} size="icon">
              <TimerResetIcon className="size-4 shrink-0" />
              <span className="sr-only">Reset</span>
            </Button>
            <Button
              variant={isPlaying ? "outline" : "default"}
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
            {[0.5, 1, 1.5, 2].map((speedValue) => (
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
