import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { ScrollIndicator } from "../ui/scroll-indicator";

type Props = {
  children: ReactNode;
  className?: string;
  scrollIndicator?: boolean;
};

export function LayoutContent({
  children,
  className,
  scrollIndicator = true,
}: Props) {
  return (
    <>
      <ScrollIndicator hidden={!scrollIndicator} />
      <article className={cn("mx-auto max-w-3xl px-6", className)}>
        {children}
      </article>
    </>
  );
}
