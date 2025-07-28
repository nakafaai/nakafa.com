"use client";

import { WindowVirtualizer, type WindowVirtualizerProps } from "virtua";
import { useVirtual } from "@/lib/context/use-virtual";

export function WindowVirtualized({
  children,
  ...props
}: {
  children: React.ReactNode;
} & WindowVirtualizerProps) {
  const virtualRef = useVirtual((state) => state.virtualRef);

  return (
    <WindowVirtualizer ref={virtualRef} {...props}>
      {children}
    </WindowVirtualizer>
  );
}
