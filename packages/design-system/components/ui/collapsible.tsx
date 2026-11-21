import {
  CollapsiblePanel as CollapsiblePanelPrimitive,
  Collapsible as CollapsiblePrimitive,
  CollapsibleTrigger as CollapsibleTriggerPrimitive,
} from "@ui-sdk/react/collapsible";
import { cn } from "cn";
import type * as React from "react";

/**
 * One region that shows and hides under its trigger. What matters most never hides in one.
 */
function Collapsible(props: React.ComponentProps<typeof CollapsiblePrimitive>) {
  return <CollapsiblePrimitive {...props} />;
}

function CollapsibleTrigger(
  props: React.ComponentProps<typeof CollapsibleTriggerPrimitive>
) {
  return <CollapsibleTriggerPrimitive {...props} />;
}

/** The region of a `Collapsible`, which grows to its content as it opens and folds back to nothing as it closes. */
function CollapsiblePanel({
  className,
  ...props
}: React.ComponentProps<typeof CollapsiblePanelPrimitive>) {
  return (
    <CollapsiblePanelPrimitive
      className={cn(
        "h-(--collapsible-panel-height) overflow-hidden transition-[height] data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  );
}

export { Collapsible, CollapsiblePanel, CollapsibleTrigger };
