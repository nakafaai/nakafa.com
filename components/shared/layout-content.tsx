import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

export function LayoutContent({ children, className }: Props) {
  return (
    <div className={cn("mx-auto max-w-3xl px-4", className)}>{children}</div>
  );
}
