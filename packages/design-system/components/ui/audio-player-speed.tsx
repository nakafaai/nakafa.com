"use client";

import { Settings01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { runAudioPlayerProgram } from "@repo/design-system/lib/audio-player/boundary";
import { useAudioPlayer } from "@repo/design-system/lib/audio-player/context";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps, HTMLAttributes } from "react";

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** Props for the compact playback-speed menu. */
export interface AudioPlayerSpeedProps extends ComponentProps<typeof Button> {
  speeds?: readonly number[];
}

/** Renders a dropdown menu for changing the active playback rate. */
export function AudioPlayerSpeed({
  speeds = PLAYBACK_SPEEDS,
  className,
  variant = "ghost",
  size = "icon",
  ...props
}: AudioPlayerSpeedProps) {
  const player = useAudioPlayer();
  const currentSpeed = player.playbackRate;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Playback speed"
            className={cn(className)}
            size={size}
            variant={variant}
            {...props}
          >
            <HugeIcons className="size-4" icon={Settings01Icon} />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-30">
        {speeds.map((speed) => (
          <DropdownMenuItem
            className="flex cursor-pointer items-center justify-between"
            key={speed}
            onClick={() =>
              runAudioPlayerProgram(
                player.setPlaybackRate(speed),
                "audio-player-speed-menu"
              )
            }
          >
            <span className="tabular-nums">
              {speed === 1 ? "Normal" : `${speed}x`}
            </span>
            {currentSpeed === speed && (
              <HugeIcons className="size-4" icon={Tick01Icon} />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Props for the expanded playback-speed button group. */
export interface AudioPlayerSpeedButtonGroupProps
  extends Omit<HTMLAttributes<HTMLFieldSetElement>, "children"> {
  speeds?: readonly number[];
}

/** Renders direct playback-rate buttons for layouts with more room. */
export function AudioPlayerSpeedButtonGroup({
  speeds = [0.5, 1, 1.5, 2],
  className,
  ...props
}: AudioPlayerSpeedButtonGroupProps) {
  const player = useAudioPlayer();
  const currentSpeed = player.playbackRate;

  return (
    <fieldset
      aria-label="Playback speed controls"
      className={cn("flex items-center gap-1", className)}
      {...props}
    >
      {speeds.map((speed) => (
        <Button
          className="min-w-12.5 font-mono text-xs"
          key={speed}
          onClick={() =>
            runAudioPlayerProgram(
              player.setPlaybackRate(speed),
              "audio-player-speed-buttons"
            )
          }
          size="sm"
          variant={currentSpeed === speed ? "default" : "outline"}
        >
          {speed}x
        </Button>
      ))}
    </fieldset>
  );
}
