"use client";

import { Nina } from "@repo/design-system/components/ui/nina";
import { Toy } from "@repo/design-system/components/ui/toy";
import type { ActSchema } from "@repo/mascot/nina/act";
import { useEffect, useRef, useState } from "react";
import { within } from "@/components/marketing/about/toys/place";

/**
 * A Nina of the page that can be picked up and carried anywhere on it. She lies
 * exactly over the still Nina the server drew at `slot`, and that one hides only
 * once she is placed, so the page never shows two Ninas or none. While she is
 * carried she hangs from the hand, and she goes back to what she did once she is
 * let go.
 */
export function NinaToy({
  act,
  size,
  slot,
}: {
  act: typeof ActSchema.Type;
  size: number;
  slot: string;
}) {
  const [carried, setCarried] = useState(false);
  const [place] = useState(() => within(slot, { x: 0, y: 0 }));
  const toy = useRef<HTMLDivElement>(null);

  // The layer shows a toy by taking away its `hidden` once it is placed: the
  // still Nina under it hides at that moment, and shows again when this one goes.
  useEffect(() => {
    const still = document.getElementById(slot);
    const element = toy.current;
    if (still === null || element === null) {
      return;
    }
    const follow = () => {
      still.style.visibility = element.hidden ? "" : "hidden";
    };
    const watching = new MutationObserver(follow);
    watching.observe(element, { attributeFilter: ["hidden"] });
    follow();
    return () => {
      watching.disconnect();
      still.style.visibility = "";
    };
  }, [slot]);

  return (
    <Toy
      onGrab={() => setCarried(true)}
      onRelease={() => setCarried(false)}
      place={place}
      ref={toy}
    >
      <Nina act={carried ? "hanging" : act} label="" size={size} whole />
    </Toy>
  );
}
