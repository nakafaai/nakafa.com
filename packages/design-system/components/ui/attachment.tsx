"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Button } from "@repo/design-system/components/ui/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

// Source: https://ui.shadcn.com/docs/components/base/attachment
const attachmentVariants = cva(
  "group/attachment relative flex w-fit min-w-0 max-w-full shrink-0 flex-wrap rounded-md border bg-card text-card-foreground transition-colors focus-within:ring-1 focus-within:ring-ring/30 has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed",
  {
    variants: {
      size: {
        default:
          "gap-2 text-sm has-data-[slot=attachment-media]:p-2 has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2",
        sm: "gap-2.5 text-xs has-data-[slot=attachment-media]:p-1.5 has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5",
        xs: "gap-1.5 text-xs has-data-[slot=attachment-media]:p-1 has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1",
      },
      orientation: {
        horizontal: "min-w-40 items-center",
        vertical: "w-24 flex-col has-data-[slot=attachment-content]:w-30",
      },
    },
  }
);

export function Attachment({
  className,
  state = "done",
  size = "default",
  orientation = "horizontal",
  ...props
}: ComponentProps<"div"> &
  VariantProps<typeof attachmentVariants> & {
    state?: "idle" | "uploading" | "processing" | "error" | "done";
  }) {
  return (
    <div
      className={cn(attachmentVariants({ size, orientation }), className)}
      data-orientation={orientation}
      data-size={size}
      data-slot="attachment"
      data-state={state}
      {...props}
    />
  );
}

const mediaVariants = cva(
  "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted text-foreground group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        icon: "",
        image:
          "opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover",
      },
    },
  }
);

export function AttachmentMedia({
  className,
  variant = "icon",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof mediaVariants>) {
  return (
    <div
      className={cn(mediaVariants({ variant }), className)}
      data-slot="attachment-media"
      data-variant={variant}
      {...props}
    />
  );
}

export function AttachmentContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1",
        className
      )}
      data-slot="attachment-content"
      {...props}
    />
  );
}

export function AttachmentTitle({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn("block min-w-0 max-w-full truncate font-medium", className)}
      data-slot="attachment-title"
      {...props}
    />
  );
}

export function AttachmentDescription({
  className,
  ...props
}: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "mt-0.5 block min-w-0 max-w-full truncate text-muted-foreground text-xs group-data-[state=error]/attachment:text-destructive/80",
        className
      )}
      data-slot="attachment-description"
      {...props}
    />
  );
}

export function AttachmentActions({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative z-20 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:top-2 group-data-[orientation=vertical]/attachment:right-2 group-data-[orientation=vertical]/attachment:gap-1",
        className
      )}
      data-slot="attachment-actions"
      {...props}
    />
  );
}

export function AttachmentAction({
  variant = "ghost",
  size = "icon-xs",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="attachment-action"
      size={size}
      variant={variant}
      {...props}
    />
  );
}

export function AttachmentTrigger({
  className,
  render,
  type,
  ...props
}: useRender.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: render ? type : (type ?? "button"),
        className: cn("absolute inset-0 z-10 outline-none", className),
      },
      props
    ),
    render,
    state: { slot: "attachment-trigger" },
  });
}

export function AttachmentGroup({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto overscroll-x-contain py-1 *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start",
        className
      )}
      data-slot="attachment-group"
      {...props}
    />
  );
}
