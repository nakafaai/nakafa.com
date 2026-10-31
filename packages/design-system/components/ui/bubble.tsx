import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

// Source: https://ui.shadcn.com/docs/components/base/bubble
const bubbleVariants = cva(
  "group/bubble relative flex w-fit max-w-4/5 min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end data-[align=end]:self-end",
  {
    variants: {
      variant: {
        default:
          "*:data-[slot=bubble-content]:bg-primary *:data-[slot=bubble-content]:text-primary-foreground",
        secondary:
          "*:data-[slot=bubble-content]:bg-secondary *:data-[slot=bubble-content]:text-secondary-foreground",
        muted: "*:data-[slot=bubble-content]:bg-muted",
      },
    },
  }
);

export function Bubble({
  variant = "default",
  align = "start",
  className,
  ...props
}: ComponentProps<"div"> &
  VariantProps<typeof bubbleVariants> & { align?: "start" | "end" }) {
  return (
    <div
      className={cn(bubbleVariants({ variant }), className)}
      data-align={align}
      data-slot="bubble"
      data-variant={variant}
      {...props}
    />
  );
}

export function BubbleContent({
  className,
  render,
  ...props
}: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "text-chat [button,a]:focus-visible:border-ring [button,a]:focus-visible:ring-ring/30 w-fit max-w-full min-w-0 overflow-hidden rounded-3xl border border-transparent px-3 py-2.5 wrap-break-word group-data-[align=end]/bubble:self-end [button]:text-left [button,a]:transition-colors [button,a]:outline-none [button,a]:focus-visible:ring-3",
          className
        ),
      },
      props
    ),
    render,
    state: { slot: "bubble-content" },
  });
}
