"use client";

import { useIntersection } from "@mantine/hooks";
import { BacterialControls } from "@repo/design-system/components/contents/mathematics/bacterial-controls";
import {
  type BacterialFormulaType,
  BacterialFormulaTypeSchema,
  getBacterialGrowthFrame,
} from "@repo/design-system/components/contents/mathematics/bacterial-growth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Schema } from "effect";
import {
  AnimatePresence,
  domMax,
  LayoutGroup,
  LazyMotion,
  MotionConfig,
} from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useState } from "react";

const SPEED_INTERVAL = 1000;
const STAGGER_DELAY = 0.01;
const SCALE_INCREASE = 1.1;

interface BacterialGrowthProps {
  /**
   * The type of formula to use.
   * @default "geometric"
   */
  formulaType?: BacterialFormulaType;
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
  timeInterval = 1, // Default: 1 hour
  timeUnit = "h", // Default: hours
  labels = {
    title: "Bacterial Growth",
    bacterial: "Bacterial",
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
  const isEffectivelyPlaying = isPlaying && generation < maxGenerations;
  const isAnimating = isEffectivelyPlaying && isInView;
  const validatedFormulaType = Schema.decodeSync(BacterialFormulaTypeSchema)(
    formulaType
  );
  const frame = getBacterialGrowthFrame({
    formulaType: validatedFormulaType,
    generation,
    initialCount,
    maxGenerations,
    ratio,
  });

  useEffect(() => {
    if (!isAnimating) {
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
  }, [isAnimating, maxGenerations, speed]);

  function resetAnimation() {
    setGeneration(0);
    setIsPlaying(true);
  }

  function togglePlayPause() {
    if (!isEffectivelyPlaying && generation >= maxGenerations) {
      // If at max generation and trying to play, restart from beginning
      setGeneration(0);
      setIsPlaying(true);
      return;
    }

    setIsPlaying((value) => !value);
  }

  function selectGeneration(nextGeneration: number) {
    setGeneration(nextGeneration);
    setIsPlaying(false);
  }

  return (
    <Card className="content-auto-card" ref={ref}>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription aria-live="polite">
          {frame.bacteriaCount} {labels.bacterial}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div
          aria-label={`${frame.bacteriaCount} ${labels.bacterial}`}
          className="relative aspect-square w-full overflow-hidden rounded-lg border bg-card sm:aspect-video"
          data-bacteria-count={frame.bacteriaCount}
          data-visible-bacteria-count={frame.bacteriaIds.length}
          role="img"
        >
          <div
            className="relative grid h-full w-full gap-0.5 p-2 sm:px-0"
            style={{
              gridTemplateColumns: `repeat(${frame.gridColumns}, minmax(0, 1fr))`,
            }}
          >
            <MotionConfig reducedMotion="user">
              <LazyMotion features={domMax} strict>
                <LayoutGroup>
                  <AnimatePresence mode="popLayout">
                    {frame.bacteriaIds.map((id, index) => (
                      <m.div
                        animate={{
                          opacity: 1,
                          scale: 1,
                          x: 0,
                        }}
                        className="relative flex items-center justify-center"
                        exit={{ opacity: 0, scale: 0.35, x: -10 }}
                        initial={{ opacity: 0, scale: 0.35, x: -10 }}
                        key={id}
                        layout
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                          delay: index * STAGGER_DELAY,
                        }}
                        whileHover={{ scale: SCALE_INCREASE }}
                      >
                        <div
                          className="aspect-square h-full max-h-5 w-full max-w-5 rounded-full bg-chart-1 sm:max-h-8 sm:max-w-8"
                          data-bacterium=""
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

      <BacterialControls
        generation={generation}
        isPlaying={isEffectivelyPlaying}
        maxGenerations={maxGenerations}
        onGenerationChange={selectGeneration}
        onReset={resetAnimation}
        onSpeedChange={setSpeed}
        onTogglePlaying={togglePlayPause}
        speed={speed}
        timeInterval={timeInterval}
        timeUnit={timeUnit}
      />
    </Card>
  );
}
