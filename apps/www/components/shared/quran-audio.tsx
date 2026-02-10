"use client";

import { PlayIcon, StopIcon } from "@hugeicons/core-free-icons";
import type { Verse } from "@repo/contents/_types/quran";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useState } from "react";
import useSound from "use-sound";

interface Props {
  audio: Verse["audio"];
}

export function QuranAudio({ audio }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  const [play, { stop }] = useSound([audio.primary, ...audio.secondary], {
    onend: () => setIsPlaying(false),
    html5: true,
    interrupt: true,
  });

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
