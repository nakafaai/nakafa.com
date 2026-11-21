import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { NodeChildren } from "@repo/design-system/lib/render";
import {
  AccordionHeader,
  AccordionItem as AccordionItemPrimitive,
  AccordionPanel,
  Accordion as AccordionPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
} from "@ui-sdk/react/accordion";
import { cn } from "cn";
import type * as React from "react";

/**
 * Sections that open one at a time or several at once, for content a reader scans by its headings, such as questions
 * and answers. Each item is a header that opens its panel; keep panels short.
 */
function Accordion({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive>) {
  return (
    <AccordionPrimitive
      className={cn("flex w-full flex-col", className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionItemPrimitive>) {
  return (
    <AccordionItemPrimitive
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: NodeChildren<React.ComponentProps<typeof AccordionTriggerPrimitive>>) {
  return (
    <AccordionHeader className="flex">
      <AccordionTriggerPrimitive
        className={cn(
          "group/accordion-trigger focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm underline-offset-4 transition-[border-color,box-shadow] outline-none hover:underline focus-visible:ring-3 data-disabled:pointer-events-none data-disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <HugeIcons
          className="text-muted-foreground pointer-events-none translate-y-0.5 transition-transform group-data-open/accordion-trigger:rotate-180 motion-reduce:transition-none"
          icon={ArrowDown01Icon}
        />
      </AccordionTriggerPrimitive>
    </AccordionHeader>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: NodeChildren<React.ComponentProps<typeof AccordionPanel>>) {
  return (
    <AccordionPanel
      className="duration-ui h-(--accordion-panel-height) overflow-hidden text-sm transition-[height] ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPanel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
