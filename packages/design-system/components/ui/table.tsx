import { cn } from "cn";
import type * as React from "react";

/**
 * Renders the responsive table container used by markdown and content tables.
 */

function Table({
  containerClassName,
  className,
  ...props
}: React.ComponentProps<"table"> & { containerClassName?: string }) {
  return (
    <div
      className={cn(
        "relative grid w-full grid-cols-1 overflow-x-auto",
        containerClassName
      )}
      data-slot="table-container"
    >
      <table
        className={cn("w-full caption-bottom text-sm", className)}
        data-slot="table"
        {...props}
      />
    </div>
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
 * Renders one table row with the shared Nakafa table styles. A row lights up under the pointer only when it takes a
 * press itself, so a hover always means the whole row is clickable; a header row, an empty row and a row of plain
 * values keep still. The row says so with `data-pressable`, which a cell that paints its own background, such as a
 * sticky one, keys on to light with the row. A row marked `data-state="selected"` (the one open beside a list) keeps
 * the accent.
 */
function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b transition-colors data-pressable:cursor-pointer data-[state=selected]:bg-accent data-[state=selected]:text-accent-foreground data-pressable:hover:bg-accent data-pressable:hover:text-accent-foreground",
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
