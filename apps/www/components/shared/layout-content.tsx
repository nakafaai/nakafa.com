import { ScrollIndicator } from "@repo/design-system/components/ui/scroll-indicator";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";

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
