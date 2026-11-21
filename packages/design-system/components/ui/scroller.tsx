import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ScrollBar } from "@repo/design-system/components/ui/scroll-area";
import { MessageScroller as Primitive } from "@shadcn/react/message-scroller";
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import { cn } from "cn";
import type { ComponentProps } from "react";

// Source: https://ui.shadcn.com/docs/components/base/message-scroller
// Consumers compose the package's Provider directly; this file owns styling.
/**
 * The scrolling list of a conversation: it keeps the reader's place as messages arrive and shows a button back to
 * the latest message. The scroll surface is UI SDK's scroll area, as every other scroller's is. The package keeps
 * what a conversation needs beyond it, which UI SDK's `stickToEnd` does not cover: a question held at the top while
 * its answer streams, the place kept as older messages load above, a jump to one message, and the messages in view.
 */
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

/**
 * The scrolling part of a message list. The package's viewport, which keeps the list at its end, is the viewport
 * of a scroll area, so its bar overlays the messages and takes no room, as every other scroller's does. The parts
 * keep their message scroller slots, which the place a reader left and the browser tests find them by.
 */
export function MessageScrollerViewport({
  children,
  className,
  ...props
}: ComponentProps<typeof Primitive.Viewport>) {
  return (
    <ScrollArea className="relative size-full min-h-0 min-w-0">
      <ScrollAreaViewport
        className={cn(
          "size-full min-h-0 min-w-0 overscroll-contain contain-content outline-none data-pending-scroll:invisible",
          className
        )}
        render={
          <Primitive.Viewport
            data-slot="message-scroller-viewport"
            {...props}
          />
        }
      >
        {children}
      </ScrollAreaViewport>
      <ScrollBar />
    </ScrollArea>
  );
}

export function MessageScrollerContent({
  children,
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <ScrollAreaContent
      className={cn("flex h-max min-h-full flex-col gap-6", className)}
      render={
        <Primitive.Content data-slot="message-scroller-content" {...props} />
      }
    >
      {children}
    </ScrollAreaContent>
  );
}

/**
 * One message of the list. Every message is laid out at its real height, never skipped with `content-visibility`:
 * the scroller places the reader by the heights above them, so a row that grew or shrank from an estimate as it came
 * into view moved what the reader was looking at, and opened a chat short of its end. Safari released before 2026
 * has no scroll anchoring to hide such a move (WebKit bug 298514). A list reads its messages a page at a time, so
 * laying out what it holds stays cheap. Each message is the box and the layer of what floats over it, such as its
 * toolbar, so one message's toolbar never stands over another's.
 */
export function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn("relative isolate min-w-0 shrink-0", className)}
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      {...props}
    />
  );
}

export function MessageScrollerButton({
  className,
  children,
  label,
  render,
  ...props
}: ComponentProps<typeof Primitive.Button> & {
  /** What the button does in words, its tooltip and its name. */
  label: string;
}) {
  return (
    <Primitive.Button
      className={cn(
        "border-border bg-background text-foreground hover:bg-muted absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full transition-[translate,scale,opacity] data-[active=false]:pointer-events-none data-[active=false]:translate-y-full data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 motion-reduce:transition-none",
        className
      )}
      data-slot="message-scroller-button"
      render={
        render ?? <Button size="icon-sm" tooltip={label} variant="outline" />
      }
      {...props}
    >
      {children ?? <HugeIcons icon={ArrowDown02Icon} />}
    </Primitive.Button>
  );
}
