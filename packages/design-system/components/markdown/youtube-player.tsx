"use client";

import { YouTubeEmbed } from "@next/third-parties/google";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Renders one YouTube embed and resets it when Activity hides the route so
 * iframe playback cannot continue inside preserved hidden DOM.
 */
export function YoutubePlayer({ videoId }: { videoId: string }) {
  const [embedKey, setEmbedKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    return () => {
      containerRef.current?.replaceChildren();
      setEmbedKey((key) => key + 1);
    };
  }, []);

  return (
    <div ref={containerRef}>
      <YouTubeEmbed key={`${videoId}-${embedKey}`} videoid={videoId} />
    </div>
  );
}
