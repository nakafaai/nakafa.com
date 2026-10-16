"use client";

import { Clock04Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Choice } from "@repo/design-system/components/contents/mathematics/choice";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { VisualCardFullscreen } from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";

const SPEED_STEP = 0.25;
const SPEED_VALUES = Array.from(
  { length: 5 },
  (_, index) => SPEED_STEP * (index + 1)
);

/** Renders the reset, playback, and full screen actions on the right of the footer. */
export function BacterialPlayback({
  isPlaying,
  onReset,
  onTogglePlaying,
}: {
  isPlaying: boolean;
  onReset: () => void;
  onTogglePlaying: () => void;
}) {
  const t = useTranslations("Common");

  return (
    <div className="ms-auto flex gap-2">
      <Button onClick={onReset} size="icon" variant="outline">
        <HugeIcons icon={Clock04Icon} />
        <span className="sr-only">{t("reset")}</span>
      </Button>
      <Button
        onClick={onTogglePlaying}
        size="icon"
        variant={isPlaying ? "outline" : "default"}
      >
        <HugeIcons icon={isPlaying ? PauseIcon : PlayIcon} />
        <span className="sr-only">{t(isPlaying ? "pause" : "play")}</span>
      </Button>
      <VisualCardFullscreen />
    </div>
  );
}

/** Renders one choice per playback speed. */
export function BacterialSpeeds({
  onSpeedChange,
  speed,
}: {
  onSpeedChange: (speed: number) => void;
  speed: number;
}) {
  return (
    <div className="flex w-full flex-wrap justify-center gap-2 px-6">
      {Arr.map(SPEED_VALUES, (speedValue) => (
        <Choice
          key={speedValue}
          onClick={() => onSpeedChange(speedValue)}
          pressed={speed === speedValue}
        >
          {speedValue}x
        </Choice>
      ))}
    </div>
  );
}

/** Renders one choice per generation, labelled with its time. */
export function BacterialGenerations({
  generation,
  maxGenerations,
  onGenerationChange,
  timeInterval,
  timeUnit,
}: {
  generation: number;
  maxGenerations: number;
  onGenerationChange: (generation: number) => void;
  timeInterval: number;
  timeUnit: string;
}) {
  return (
    <div className="flex w-full flex-wrap justify-center gap-2 px-6">
      {Array.from({ length: maxGenerations + 1 }, (_, index) => {
        const time = index * timeInterval;

        return (
          <Choice
            key={time.toString()}
            onClick={() => onGenerationChange(index)}
            pressed={generation === index}
          >
            {time} {timeUnit}
          </Choice>
        );
      })}
    </div>
  );
}
