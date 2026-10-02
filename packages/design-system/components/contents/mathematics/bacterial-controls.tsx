"use client";

import { Clock04Icon, PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { VisualCardFullscreen } from "@repo/design-system/components/visual/card";
import { cva } from "class-variance-authority";
import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";

const SPEED_STEP = 0.25;
const SPEED_VALUES = Array.from(
  { length: 5 },
  (_, index) => SPEED_STEP * (index + 1)
);

/**
 * The pressed option keeps a transparent border as wide as the others'
 * outline, so every option keeps its size whichever one is pressed.
 */
const choiceVariants = cva("", {
  variants: {
    pressed: {
      false: "",
      true: "border border-transparent",
    },
  },
});

/**
 * One option of a set, filled when pressed and outlined otherwise. An option
 * that changes on its own, such as the generation the growth reaches, moves
 * none of the others.
 */
function Choice({
  pressed,
  ...props
}: Omit<ComponentProps<typeof Button>, "size" | "variant"> & {
  pressed: boolean;
}) {
  return (
    <Button
      aria-pressed={pressed}
      className={choiceVariants({ pressed })}
      size="sm"
      variant={pressed ? "default" : "outline"}
      {...props}
    />
  );
}

/** Renders the reset, playback, full screen, and speed controls. */
export function BacterialPlayback({
  isPlaying,
  onReset,
  onSpeedChange,
  onTogglePlaying,
  speed,
}: {
  isPlaying: boolean;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onTogglePlaying: () => void;
  speed: number;
}) {
  const t = useTranslations("Common");

  return (
    <div className="flex w-full flex-col items-center justify-between gap-4 px-6 sm:flex-row">
      <div className="flex justify-between gap-2">
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

      <div className="flex flex-wrap justify-center gap-2">
        {SPEED_VALUES.map((speedValue) => (
          <Choice
            key={speedValue}
            onClick={() => onSpeedChange(speedValue)}
            pressed={speed === speedValue}
          >
            {speedValue}x
          </Choice>
        ))}
      </div>
    </div>
  );
}

/** Renders one button per generation, labelled with its time. */
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
    <div className="w-full border-t px-6 pt-4">
      <div className="flex flex-wrap justify-center gap-2">
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
    </div>
  );
}
