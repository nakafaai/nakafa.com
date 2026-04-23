"use client";

import { YouTubeEmbed } from "@next/third-parties/google";
import { useLayoutEffect, useState } from "react";

/**
 * Renders one YouTube embed and remounts it when Activity hides the route so
 * iframe playback cannot continue inside preserved hidden DOM.
 */
export function YoutubePlayer({ videoId }: { videoId: string }) {
  const [embedKey, setEmbedKey] = useState(0);

  useLayoutEffect(
    () => () => {
      setEmbedKey((key) => key + 1);
    },
    []
  );

  return <YouTubeEmbed key={`${videoId}-${embedKey}`} videoid={videoId} />;
}
