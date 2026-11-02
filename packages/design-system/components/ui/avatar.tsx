import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import { cn } from "cn";
import type * as React from "react";

function Avatar({
  className,
  size = "default",
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: "default" | "sm" | "lg";
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "group/avatar after:border-border relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten",
        className
      )}
      data-size={size}
      data-slot="avatar"
      {...props}
    />
  );
}

/**
 * The picture itself, a plain image, so the first HTML holds it and the browser
 * paints it as it arrives. A muted circle holds its place until then.
 */
function AvatarImage({ className, ...props }: React.ComponentProps<"img">) {
  return (
    <img
      alt=""
      className={cn(
        "bg-muted aspect-square size-full rounded-full object-cover",
        className
      )}
      data-slot="avatar-image"
      decoding="sync"
      height={96}
      width={96}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "bg-muted text-muted-foreground flex size-full items-center justify-center overflow-hidden rounded-full text-sm group-data-[size=sm]/avatar:text-xs",
        className
      )}
      data-slot="avatar-fallback"
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      data-slot="avatar-badge"
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/avatar-group *:data-[slot=avatar]:ring-background flex -space-x-2 has-data-[size=lg]:[--avatar-count-icon:--spacing(5)] has-data-[size=lg]:[--avatar-count:--spacing(10)] has-data-[size=sm]:[--avatar-count-icon:--spacing(3)] has-data-[size=sm]:[--avatar-count:--spacing(6)] *:data-[slot=avatar]:ring-2",
        className
      )}
      data-slot="avatar-group"
      {...props}
    />
  );
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted text-muted-foreground ring-background relative flex size-[var(--avatar-count,--spacing(8))] shrink-0 items-center justify-center rounded-full text-sm ring-2 [&>svg]:size-[var(--avatar-count-icon,--spacing(4))]",
        className
      )}
      data-slot="avatar-group-count"
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
};
