import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function LayoutContent({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto max-w-3xl px-4", className)}>{children}</div>
  );
}
