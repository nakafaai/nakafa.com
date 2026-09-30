"use client";

import { WindowVirtualizer, type WindowVirtualizerProps } from "virtua";
import { useVirtual } from "@/lib/content/virtual";

/** Virtualizes window-scrolled items through the page's shared handle. */
export function WindowVirtualized<T>(props: WindowVirtualizerProps<T>) {
  const virtualRef = useVirtual((state) => state.virtualRef);

  return <WindowVirtualizer ref={virtualRef} {...props} />;
}
