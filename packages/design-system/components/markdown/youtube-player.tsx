"use client";

import { PlayIcon } from "@hugeicons/core-free-icons";
import { Image } from "@repo/design-system/components/image";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useLayoutEffect, useState } from "react";

interface Props {
  /** The accessible name of the play button, and the title of the player once it loads. */
  readonly label: string;
  readonly videoId: string;
}

/**
 * Renders one YouTube video as its poster with a play button. The player loads
 * only when the visitor presses play. When Activity hides the route, the cleanup
 * returns the video to its poster, so no playback continues inside preserved
 * hidden DOM.
 */
export function YoutubePlayer({ label, videoId }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);

  useLayoutEffect(
    () => () => {
      setIsPlaying(false);
    },
    []
  );

  if (isPlaying) {
    return (
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="size-full border-0"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
        title={label}
      />
    );
  }

  return (
    <button
      aria-label={label}
      className="group relative block size-full cursor-pointer"
      onClick={() => setIsPlaying(true)}
      type="button"
    >
      <Image
        alt=""
        className="object-cover"
        fill
        height={360}
        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
        width={480}
      />
      <span className="absolute inset-0 grid place-items-center bg-black/10 transition-colors group-hover:bg-black/20">
        <span className="grid size-16 place-items-center rounded-full bg-black/70 text-white transition-transform group-hover:scale-105">
          <HugeIcons icon={PlayIcon} />
        </span>
      </span>
    </button>
  );
}
