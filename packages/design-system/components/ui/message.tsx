import { cn } from "cn";
import type { ComponentProps } from "react";

// Source: https://ui.shadcn.com/docs/components/base/message
export function MessageGroup({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2", className)}
      data-slot="message-group"
      {...props}
    />
  );
}

export function Message({
  className,
  align = "start",
  ...props
}: ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      className={cn(
        "group/message text-chat relative flex w-full min-w-0 gap-2 has-data-[slot=message-footer]:[--message-avatar-y:--spacing(-8)] has-data-[variant=ghost]:[--message-header-x:0rem] data-[align=end]:flex-row-reverse",
        className
      )}
      data-align={align}
      data-slot="message"
      {...props}
    />
  );
}

export function MessageAvatar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted flex w-fit min-w-8 shrink-0 translate-y-(--message-avatar-y) items-center justify-center self-end overflow-hidden rounded-full",
        className
      )}
      data-slot="message-avatar"
      {...props}
    />
  );
}

export function MessageContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
        className
      )}
      data-slot="message-content"
      {...props}
    />
  );
}

export function MessageHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex max-w-full min-w-0 items-center px-[var(--message-header-x,--spacing(3))] text-xs font-medium",
        className
      )}
      data-slot="message-header"
      {...props}
    />
  );
}

export function MessageFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex max-w-full min-w-0 items-center text-xs group-data-[align=end]/message:justify-end",
        className
      )}
      data-slot="message-footer"
      {...props}
    />
  );
}
