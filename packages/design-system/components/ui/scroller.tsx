"use client";

import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import { cn } from "cn";
import type { ComponentProps } from "react";

// Source: https://ui.shadcn.com/docs/components/base/message-scroller
// Consumers compose the package's Provider directly; this file owns styling.
export function MessageScroller({
  className,
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        className
      )}
      data-slot="message-scroller"
      {...props}
    />
  );
}

export function MessageScrollerViewport({
  className,
  ...props
}: ComponentProps<typeof Primitive.Viewport>) {
  return (
    <Primitive.Viewport
      className={cn(
        "size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain contain-content [scrollbar-gutter:stable] [scrollbar-width:thin] data-pending-scroll:invisible",
        className
      )}
      data-slot="message-scroller-viewport"
      {...props}
    />
  );
}

export function MessageScrollerContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      className={cn("flex h-max min-h-full flex-col gap-6", className)}
      data-slot="message-scroller-content"
      {...props}
    />
  );
}

export function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        "min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]",
        className
      )}
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      {...props}
    />
  );
}

export function MessageScrollerButton({
  className,
  children,
  render,
  ...props
}: ComponentProps<typeof Primitive.Button>) {
  return (
    <Primitive.Button
      className={cn(
        "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border-border bg-background text-foreground transition-[translate,scale,opacity] duration-200 hover:bg-muted data-[active=false]:pointer-events-none data-[active=false]:translate-y-full data-[active=true]:translate-y-0 data-[active=false]:scale-95 data-[active=true]:scale-100 data-[active=false]:opacity-0 data-[active=true]:opacity-100 motion-reduce:transition-none",
        className
      )}
      data-slot="message-scroller-button"
      render={render ?? <Button size="icon-sm" variant="outline" />}
      {...props}
    >
      {children ?? <HugeIcons icon={ArrowDown02Icon} />}
    </Primitive.Button>
  );
}
