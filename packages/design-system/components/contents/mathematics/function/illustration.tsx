import { ArrowDown02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { buttonVariants } from "@repo/design-system/lib/button";
import type { ReactNode } from "react";

interface Props {
  content: {
    input: ReactNode;
    output: ReactNode;
  };
  description: ReactNode;
  machineLabel: ReactNode;
  title: ReactNode;
}

/**
 * Renders the reversible mapping used to explain inverse functions. The input and the output wear a button's look
 * but are values, not actions, so they are plain text that a screen reader reads with its math and a keyboard skips.
 */
export function FunctionIllustration({
  title,
  description,
  machineLabel,
  content,
}: Props) {
  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody>
        <div className="flex flex-col items-center justify-center gap-8 px-(--card-spacing) py-8 sm:flex-row">
          <span
            className={buttonVariants({ className: "pointer-events-none" })}
          >
            {content.input}
          </span>

          <HugeIcons className="hidden sm:block" icon={ArrowRight02Icon} />
          <HugeIcons className="block sm:hidden" icon={ArrowDown02Icon} />

          <div className="bg-accent text-accent-foreground flex items-center justify-center rounded-md p-8">
            {machineLabel}
          </div>

          <HugeIcons className="block sm:hidden" icon={ArrowDown02Icon} />
          <HugeIcons className="hidden sm:block" icon={ArrowRight02Icon} />

          <span
            className={buttonVariants({
              className: "pointer-events-none",
              variant: "destructive",
            })}
          >
            {content.output}
          </span>
        </div>
      </VisualCardBody>
      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>
    </VisualCard>
  );
}
