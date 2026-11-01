import { PlayIcon } from "@hugeicons/core-free-icons";
import { Image } from "@repo/design-system/components/image";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useLayoutEffect, useState } from "react";

/**
 * What the player may do. It runs its own scripts on its own origin, and its
 * title and logo open YouTube in a new tab, unless it is sealed.
 */
const PLAYER_SANDBOX = "allow-scripts allow-same-origin allow-presentation";
const LINKS_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";

interface Props {
  /** The accessible name of the play button, and the title of the player once it loads. */
  readonly label: string;
  /** Keeps the viewer on the page, as an exam's paper does: the player opens no new tab. */
  readonly sealed?: boolean;
  readonly videoId: string;
}

/**
 * Renders one YouTube video as its poster with a play button. The player loads
 * only when the visitor presses play. When Activity hides the route, the cleanup
 * returns the video to its poster, so no playback continues inside preserved
 * hidden DOM.
 */
export function YoutubePlayer({ label, sealed = false, videoId }: Props) {
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
        sandbox={sealed ? PLAYER_SANDBOX : `${PLAYER_SANDBOX} ${LINKS_SANDBOX}`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
        title={label}
      />
    );
  }

  return (
    <button
      aria-label={label}
      className="group relative block size-full"
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
