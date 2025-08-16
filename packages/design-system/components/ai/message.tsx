import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { cn } from "@repo/design-system/lib/utils";
import type { UIMessage } from "ai";
import { type ComponentProps, type HTMLAttributes, memo } from "react";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = memo(({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end gap-2 py-4",
      from === "user" ? "is-user" : "is-assistant flex-row-reverse justify-end",
      className
    )}
    {...props}
  />
));
Message.displayName = "Message";

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = memo(
  ({ children, className, ...props }: MessageContentProps) => (
    <div
      className={cn(
        "flex flex-col gap-2 overflow-hidden rounded-lg text-foreground/80",
        "group-[.is-user]:bg-primary group-[.is-user]:px-3 group-[.is-user]:py-2 group-[.is-user]:text-primary-foreground",
        "group-[.is-assistant]:rounded-none",
        className
      )}
      {...props}
    >
      <div className="is-user:dark">{children}</div>
    </div>
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
MessageContent.displayName = "MessageContent";

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = memo(
  ({ src, name, className, ...props }: MessageAvatarProps) => (
    <Avatar className={cn("size-8 ring-1 ring-border", className)} {...props}>
      <AvatarImage alt="" className="mt-0 mb-0" src={src} />
      <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
    </Avatar>
  )
);
MessageAvatar.displayName = "MessageAvatar";
