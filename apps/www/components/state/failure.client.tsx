"use client";

import type { ComponentProps } from "react";
import { Broken } from "@/components/state/broken";
import { Stage } from "@/components/state/stage";

/**
 * The failure screen that every error root shows: the stage with the broken state
 * in its middle. The error roots load it with next/dynamic, so the code of the
 * stage and of the particles behind it does not sit in every page's first load.
 */
export function Failure(props: ComponentProps<typeof Broken>) {
  return (
    <Stage>
      <Broken {...props} />
    </Stage>
  );
}
