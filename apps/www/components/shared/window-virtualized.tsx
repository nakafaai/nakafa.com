"use client";

import { WindowVirtualizer } from "virtua";
import { useVirtual } from "@/lib/context/use-virtual";

export function WindowVirtualized({ children }: { children: React.ReactNode }) {
  const virtualRef = useVirtual((state) => state.virtualRef);

  return <WindowVirtualizer ref={virtualRef}>{children}</WindowVirtualizer>;
}
