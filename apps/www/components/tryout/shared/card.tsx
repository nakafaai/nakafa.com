import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";

/**
 * Provides the try-out card frame shared by catalog and detail surfaces.
 */
export function TryoutCard({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}

/**
 * Aligns the try-out card illustration and primary content using the established
 * responsive card layout.
 */
export function TryoutCardHero({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 p-5 sm:flex-row sm:items-center",
        className
      )}
      {...props}
    />
  );
}

/**
 * Reserves a stable illustration area so try-out card artwork does not shift
 * adjacent text or actions.
 */
export function TryoutCardArt({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex size-28 shrink-0 items-center justify-center rounded-xl bg-muted/40 sm:size-32",
        className
      )}
      {...props}
    />
  );
}

/**
 * Stacks the try-out card title, metadata, and actions inside the shared card
 * frame.
 */
export function TryoutCardBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-1 flex-col gap-3", className)} {...props} />
  );
}

/**
 * Groups concise try-out card copy inside the shared try-out card frame.
 */
export function TryoutCardCopy({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

/**
 * Renders the try-out card heading with the density used by the catalog card
 * list.
 */
export function TryoutCardTitle({
  children,
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("font-medium text-lg", className)} {...props}>
      {children}
    </h2>
  );
}

/**
 * Renders concise helper copy that disambiguates try-out catalog rows.
 */
export function TryoutCardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return <p className={cn("text-muted-foreground", className)} {...props} />;
}

/**
 * Provides the unstyled content slot for try-out card actions and structured
 * details.
 */
export function TryoutCardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn(className)} {...props} />;
}
