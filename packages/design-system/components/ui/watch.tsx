"use client";

import { watch } from "@repo/design-system/lib/watch";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * The eyes of every animal and of Nina inside it look toward the pointer, a
 * few units at most, with one listener and one frame for the whole group. A
 * face is an `svg` marked with `data-look`; its eyes carry the `look` utility.
 * Nothing listens while the group is far from the screen, and with reduced
 * motion nothing follows.
 *
 * Load it when a page has been drawn: the eyes stay still until it has.
 */
export function Watch({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (element.current) {
      return watch(element.current);
    }
  }, []);
  return (
    <div className={className} ref={element}>
      {children}
    </div>
  );
}
