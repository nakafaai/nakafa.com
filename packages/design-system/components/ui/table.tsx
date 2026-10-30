import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import { cn } from "cn";
import type * as React from "react";

/**
 * Renders the responsive table container used by markdown, content and data tables. A table wider or taller than
 * its container scrolls under overlay bars that take no room, and a sticky head sticks inside it.
 */
function Table({
  containerClassName,
  className,
  viewportRef,
  ...props
}: React.ComponentProps<"table"> & {
  containerClassName?: string;
  /** The element that scrolls the table, for a caller that observes its scroll, such as an infinite list. */
  viewportRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <ScrollArea
      className={cn("w-full", containerClassName)}
      data-slot="table-container"
      viewportRef={viewportRef}
    >
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        data-slot="table"
        {...props}
      />
    </ScrollArea>
  );
}

/**
 * Renders the semantic table header section.
 */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("[&_tr]:border-b", className)}
      data-slot="table-header"
      {...props}
    />
  );
}

/**
 * Renders the semantic table body section.
 */
function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      data-slot="table-body"
      {...props}
    />
  );
}

/**
 * Renders the semantic table footer section.
 */
function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      data-slot="table-footer"
      {...props}
    />
  );
}

/**
 * Renders one table row with the shared Nakafa table styles.
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b transition-colors hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground",
        className
      )}
      data-slot="table-row"
      {...props}
    />
  );
}

/**
 * Renders one table heading cell.
 */
function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
        className
      )}
      data-slot="table-head"
      {...props}
    />
  );
}

/**
 * Renders one table data cell.
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "wrap-anywhere px-4 py-2 align-middle [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
        className
      )}
      data-slot="table-cell"
      {...props}
    />
  );
}

/**
 * Renders the optional table caption.
 */
function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      className={cn("mt-4 text-muted-foreground text-sm", className)}
      data-slot="table-caption"
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};
