import { ArrowDown02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
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

/** Renders the reversible mapping used to explain inverse functions. */
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
        <div className="flex flex-col items-center justify-center gap-8 py-8 sm:flex-row">
          <Button className="pointer-events-none">{content.input}</Button>

          <HugeIcons
            className="hidden size-4 sm:block"
            icon={ArrowRight02Icon}
          />
          <HugeIcons
            className="block size-4 sm:hidden"
            icon={ArrowDown02Icon}
          />

          <div className="flex items-center justify-center rounded-md bg-accent p-8 text-accent-foreground">
            {machineLabel}
          </div>

          <HugeIcons
            className="block size-4 sm:hidden"
            icon={ArrowDown02Icon}
          />
          <HugeIcons
            className="hidden size-4 sm:block"
            icon={ArrowRight02Icon}
          />

          <Button className="pointer-events-none" variant="destructive">
            {content.output}
          </Button>
        </div>
      </VisualCardBody>
      <VisualCardFooter>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}
