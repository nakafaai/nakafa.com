"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { runAudioPlayerProgram } from "@repo/design-system/lib/audio-player/boundary";
import {
  useAudioPlayer,
  useAudioPlayerTime,
} from "@repo/design-system/lib/audio-player/context";
import { formatAudioPlayerTime } from "@repo/design-system/lib/audio-player/runtime";
import { cn } from "@repo/design-system/lib/utils";
import { type HTMLProps, useRef } from "react";

/** Renders an accessible seek control for the active audio item. */
export function AudioPlayerProgress({
  ...otherProps
}: Omit<SliderPrimitive.Root.Props<number>, "min" | "max" | "value">) {
  const player = useAudioPlayer();
  const time = useAudioPlayerTime();
  const wasPlayingRef = useRef(false);

  return (
    <SliderPrimitive.Root
      {...otherProps}
      className={cn(
        "group/player relative flex h-4 cursor-grab touch-none select-none items-center active:cursor-grabbing data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-disabled:opacity-50",
        otherProps.className
      )}
      disabled={
        player.duration === undefined ||
        !Number.isFinite(player.duration) ||
        Number.isNaN(player.duration)
      }
      max={player.duration ?? 0}
      min={0}
      onKeyDown={(event) => {
        if (event.key === " ") {
          event.preventDefault();
          if (player.isPlaying) {
            runAudioPlayerProgram(player.pause(), "audio-player-timeline-key");
          } else {
            runAudioPlayerProgram(player.play(), "audio-player-timeline-key");
          }
        }
        otherProps.onKeyDown?.(event);
      }}
      onPointerDown={(event) => {
        wasPlayingRef.current = player.isPlaying;
        runAudioPlayerProgram(player.pause(), "audio-player-timeline-pointer");
        otherProps.onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        if (wasPlayingRef.current) {
          runAudioPlayerProgram(player.play(), "audio-player-timeline-pointer");
        }
        otherProps.onPointerUp?.(event);
      }}
      onValueChange={(value, eventDetails) => {
        runAudioPlayerProgram(player.seek(value), "audio-player-timeline-seek");
        otherProps.onValueChange?.(value, eventDetails);
      }}
      step={otherProps.step || 0.25}
      thumbAlignment="edge"
      value={time}
    >
      <SliderPrimitive.Control className="relative flex h-full w-full items-center">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full border border-input bg-background">
          <SliderPrimitive.Indicator className="h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="relative flex size-0 items-center justify-center opacity-0 focus-visible:opacity-100 focus-visible:outline-none group-hover/player:opacity-100 data-disabled:pointer-events-none data-disabled:opacity-50"
          data-slot="slider-thumb"
        >
          <div className="absolute size-3 rounded-full border border-primary bg-background" />
        </SliderPrimitive.Thumb>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

/** Renders the current playback position. */
export function AudioPlayerTime({
  className,
  ...otherProps
}: HTMLProps<HTMLSpanElement>) {
  const time = useAudioPlayerTime();
  return (
    <span
      {...otherProps}
      className={cn("text-muted-foreground text-sm tabular-nums", className)}
    >
      {formatAudioPlayerTime(time)}
    </span>
  );
}

/** Renders the active item's duration once metadata is available. */
export function AudioPlayerDuration({
  className,
  ...otherProps
}: HTMLProps<HTMLSpanElement>) {
  const player = useAudioPlayer();
  return (
    <span
      {...otherProps}
      className={cn("text-muted-foreground text-sm tabular-nums", className)}
    >
      {player.duration !== null &&
      player.duration !== undefined &&
      Number.isFinite(player.duration)
        ? formatAudioPlayerTime(player.duration)
        : "--:--"}
    </span>
  );
}
