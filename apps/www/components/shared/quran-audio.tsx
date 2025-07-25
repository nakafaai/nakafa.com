"use client";

import type { Verse } from "@repo/contents/_types/quran";
import { Button } from "@repo/design-system/components/ui/button";
import { PlayIcon, SquareIcon } from "lucide-react";
import { useState } from "react";
import useSound from "use-sound";

type Props = {
  audio: Verse["audio"];
};

export function QuranAudio({ audio }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  const [play, { stop }] = useSound([audio.primary, ...audio.secondary], {
    onend: () => setIsPlaying(false),
    html5: true,
    interrupt: true,
  });

  const handleToggle = () => {
    if (isPlaying) {
      stop();
      setIsPlaying(false);
    } else {
      play();
      setIsPlaying(true);
    }
  };

  return (
    <Button
      onClick={handleToggle}
      size="icon"
      variant={isPlaying ? "destructive" : "outline"}
    >
      {isPlaying ? <SquareIcon /> : <PlayIcon />}
      <span className="sr-only">{isPlaying ? "Stop audio" : "Play audio"}</span>
    </Button>
  );
}
