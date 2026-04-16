"use client";

import { PlayIcon, StopIcon } from "@hugeicons/core-free-icons";
import type { Verse } from "@repo/contents/_types/quran";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useLayoutEffect, useState } from "react";
import useSound from "use-sound";

interface Props {
  audio: Verse["audio"];
}

/**
 * Renders an audio toggle for one Quran verse.
 *
 * Audio playback is transient UI, so it stops and resets when Next hides the
 * page through Cache Components state preservation.
 *
 * References:
 * - Next.js preserving UI state with Cache Components:
 *   `apps/www/node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`
 */
export function QuranAudio({ audio }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  const [play, { stop }] = useSound([audio.primary, ...audio.secondary], {
    onend: () => setIsPlaying(false),
    html5: true,
    interrupt: true,
  });

  useLayoutEffect(
    () => () => {
      stop();
      setIsPlaying(false);
    },
    [stop]
  );

  function handleToggle() {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
    } else {
      play();
      setIsPlaying(true);
    }
  }

  return (
    <Button
      aria-label={isPlaying ? "Stop audio" : "Play audio"}
      onClick={handleToggle}
      size="icon"
      variant={isPlaying ? "destructive" : "outline"}
    >
      <HugeIcons icon={isPlaying ? StopIcon : PlayIcon} />
      <span className="sr-only">{isPlaying ? "Stop audio" : "Play audio"}</span>
    </Button>
  );
}
