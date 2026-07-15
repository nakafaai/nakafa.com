"use client";

import { PauseIcon, PlayIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { runAudioPlayerProgram } from "@repo/design-system/lib/audio-player/boundary";
import { useAudioPlayer } from "@repo/design-system/lib/audio-player/context";
import type { AudioPlayerItem } from "@repo/design-system/lib/audio-player/runtime";
import { cn } from "@repo/design-system/lib/utils";
import { Effect, Fiber } from "effect";
import { type ComponentProps, useEffect } from "react";

interface SpinnerProps {
  className?: string;
}

function Spinner({ className }: SpinnerProps) {
  return (
    <output
      aria-label="Loading"
      className={cn(
        "size-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current",
        className
      )}
    >
      <span className="sr-only">Loading&hellip;</span>
    </output>
  );
}

interface PlayButtonProps extends ComponentProps<typeof Button> {
  loading?: boolean;
  onPlayingChange: (playing: boolean) => void;
  playing: boolean;
}

function PlayButton({
  playing,
  onPlayingChange,
  className,
  onClick,
  loading,
  ...otherProps
}: PlayButtonProps) {
  return (
    <Button
      {...otherProps}
      aria-label={playing ? "Pause" : "Play"}
      className={cn("relative", className)}
      onClick={(event) => {
        onPlayingChange(!playing);
        onClick?.(event);
      }}
      type="button"
    >
      {playing ? (
        <HugeIcons
          aria-hidden="true"
          className={cn("size-4", loading && "opacity-0")}
          icon={PauseIcon}
        />
      ) : (
        <HugeIcons
          aria-hidden="true"
          className={cn("size-4", loading && "opacity-0")}
          icon={PlayIcon}
        />
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] backdrop-blur-xs">
          <Spinner />
        </div>
      )}
    </Button>
  );
}

/** Props for a player-level or item-specific play/pause button. */
export interface AudioPlayerButtonProps<TData = unknown>
  extends ComponentProps<typeof Button> {
  item?: AudioPlayerItem<TData>;
}

/** Toggles playback for either the active item or a supplied audio item. */
export function AudioPlayerButton<TData = unknown>({
  item,
  ...otherProps
}: AudioPlayerButtonProps<TData>) {
  const player = useAudioPlayer();

  if (!item) {
    return (
      <PlayButton
        {...otherProps}
        loading={player.isBuffering && player.isPlaying}
        onPlayingChange={(shouldPlay) => {
          if (shouldPlay) {
            runAudioPlayerProgram(player.play(), "audio-player-button");
          } else {
            runAudioPlayerProgram(player.pause(), "audio-player-button");
          }
        }}
        playing={player.isPlaying}
      />
    );
  }

  return (
    <PlayButton
      {...otherProps}
      loading={
        player.isItemActive(item.id) && player.isBuffering && player.isPlaying
      }
      onPlayingChange={(shouldPlay) => {
        if (shouldPlay) {
          runAudioPlayerProgram(player.play(item), "audio-player-item-button");
        } else {
          runAudioPlayerProgram(player.pause(), "audio-player-item-button");
        }
      }}
      playing={player.isItemActive(item.id) && player.isPlaying}
    />
  );
}

/** Props for preloading one item into the nearest player provider. */
export interface AudioPlayerInitializerProps<TData = unknown> {
  item: AudioPlayerItem<TData>;
}

/**
 * Preloads one audio item as soon as the surrounding player mounts.
 *
 * Related docs: https://react.dev/reference/react/useEffect
 */
export function AudioPlayerInitializer<TData = unknown>({
  item,
}: AudioPlayerInitializerProps<TData>) {
  const { setActiveItem } = useAudioPlayer();

  useEffect(() => {
    const fiber = runAudioPlayerProgram(
      setActiveItem(item),
      "audio-player-initializer"
    );

    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [item, setActiveItem]);

  return null;
}
