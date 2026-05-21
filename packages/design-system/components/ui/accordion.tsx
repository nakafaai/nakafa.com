"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      className={cn("flex w-full flex-col", className)}
      data-slot="accordion"
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      className={cn("border-b last:border-b-0", className)}
      data-slot="accordion-item"
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        className={cn(
          "group/accordion-trigger flex flex-1 cursor-pointer items-start justify-between gap-4 rounded-md py-4 text-left text-sm underline-offset-4 outline-none transition-all hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
          className
        )}
        data-slot="accordion-trigger"
        {...props}
      >
        {children}
        <HugeIcons
          className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-aria-expanded/accordion-trigger:rotate-180"
          icon={ArrowDown01Icon}
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      className="overflow-hidden text-sm data-closed:animate-accordion-up data-open:animate-accordion-down"
      data-slot="accordion-content"
      {...props}
    >
      <div
        className={cn(
          "h-(--accordion-panel-height) pt-0 pb-4 data-ending-style:h-0 data-starting-style:h-0",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
