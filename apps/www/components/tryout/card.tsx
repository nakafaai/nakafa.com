import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";

export function TryoutCard({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}

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

export function TryoutCardBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-1 flex-col gap-3", className)} {...props} />
  );
}

export function TryoutCardCopy({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function TryoutCardTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return <h2 className={cn("font-medium text-lg", className)} {...props} />;
}

export function TryoutCardDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return <p className={cn("text-muted-foreground", className)} {...props} />;
}

export function TryoutCardContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("border-t", className)} {...props} />;
}
