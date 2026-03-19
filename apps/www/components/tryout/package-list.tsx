import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";

export function TryoutPackageEmpty({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("px-5 py-4 text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export function TryoutPackageGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={className} {...props} />;
}

export function TryoutPackageYear({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "px-5 pt-4 pb-2 font-medium text-muted-foreground text-sm",
        className
      )}
      {...props}
    />
  );
}

export function TryoutPackageItems({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("grid", className)} {...props} />;
}

export function TryoutPackageLink({
  children,
  className,
  ...props
}: React.ComponentProps<typeof NavigationLink>) {
  return (
    <NavigationLink
      className={cn(
        "group flex items-center justify-between gap-3 border-t px-5 py-4 tabular-nums transition-colors ease-out first:border-t-0 last:pb-5 hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
      <HugeIcons
        className="size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100"
        icon={ArrowRight02Icon}
      />
    </NavigationLink>
  );
}

export function TryoutPackageCopy({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("space-y-1", className)} {...props} />;
}

export function TryoutPackageTitle({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return <p className={cn("font-medium capitalize", className)} {...props} />;
}

export function TryoutPackageMeta({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground text-sm group-hover:text-accent-foreground/80",
        className
      )}
      {...props}
    />
  );
}
