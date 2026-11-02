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
  viewportRef?: React.Ref<HTMLDivElement> | undefined;
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
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      data-slot="table-footer"
      {...props}
    />
  );
}

/**
 * Renders one table row with the shared Nakafa table styles. A row lights up under the pointer only when it takes a
 * press itself, so a hover always means the whole row is clickable; a header row, an empty row and a row of plain
 * values keep still. The row says so with `data-pressable`, which a cell that paints its own background, such as a
 * sticky one, keys on to light with the row. A row marked `data-state="selected"` (the one open beside a list) keeps
 * the same colour. A row lights in `muted` and never in `accent`, which a button's hover takes, so a button inside a
 * lit row still reads as its own target.
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "data-[state=selected]:bg-muted data-pressable:hover:bg-muted border-b transition-colors has-[td:first-child_a[href]]:hover:[--table-row-fill:var(--muted)] data-pressable:cursor-pointer",
        className
      )}
      data-pressable={props.onClick === undefined ? undefined : ""}
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
        "h-10 px-4 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
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
        "px-4 py-2 align-middle wrap-anywhere [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
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
      className={cn("text-muted-foreground mt-4 text-sm", className)}
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
