"use client";

import { Clock04Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { CardFooter } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";

const SPEED_STEP = 0.25;
const SPEED_VALUES = Array.from(
  { length: 5 },
  (_, index) => SPEED_STEP * (index + 1)
);

interface BacterialControlsProps {
  generation: number;
  isPlaying: boolean;
  maxGenerations: number;
  onGenerationChange: (generation: number) => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onTogglePlaying: () => void;
  speed: number;
  timeInterval: number;
  timeUnit: string;
}

/** Renders the generation selection controls for the bacterial animation. */
function GenerationButtons({
  generation,
  maxGenerations,
  onGenerationChange,
  timeInterval,
  timeUnit,
}: Pick<
  BacterialControlsProps,
  | "generation"
  | "maxGenerations"
  | "onGenerationChange"
  | "timeInterval"
  | "timeUnit"
>) {
  return Array.from({ length: maxGenerations + 1 }, (_, index) => {
    const time = index * timeInterval;

    return (
      <Button
        key={time.toString()}
        onClick={() => onGenerationChange(index)}
        size="sm"
        variant={generation === index ? "default" : "outline"}
      >
        {time}
        {timeUnit}
      </Button>
    );
  });
}

/** Owns the playback, speed, and generation controls for bacterial growth. */
export function BacterialControls({
  generation,
  isPlaying,
  maxGenerations,
  onGenerationChange,
  onReset,
  onSpeedChange,
  onTogglePlaying,
  speed,
  timeInterval,
  timeUnit,
}: BacterialControlsProps) {
  return (
    <CardFooter className="flex flex-col gap-4 px-0">
      <div className="flex w-full flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex justify-between gap-2">
          <Button
            aria-label="Reset"
            onClick={onReset}
            size="icon"
            variant="outline"
          >
            <HugeIcons icon={Clock04Icon} />
            <span className="sr-only">Reset</span>
          </Button>
          <Button
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={onTogglePlaying}
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
              onClick={() => onSpeedChange(speedValue)}
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
          <GenerationButtons
            generation={generation}
            maxGenerations={maxGenerations}
            onGenerationChange={onGenerationChange}
            timeInterval={timeInterval}
            timeUnit={timeUnit}
          />
        </div>
      </div>
    </CardFooter>
  );
}
