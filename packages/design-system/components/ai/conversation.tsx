"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import { type ComponentProps, memo, useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = memo(
  ({ className, ...props }: ConversationProps) => (
    <StickToBottom
      className={cn("relative flex-1 overflow-y-auto", className)}
      initial="smooth"
      resize="smooth"
      role="log"
      {...props}
    />
  )
);
Conversation.displayName = "Conversation";

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;

export const ConversationContent = memo(
  ({ className, ...props }: ConversationContentProps) => (
    <StickToBottom.Content
      className={cn("flex flex-col gap-4 p-4", className)}
      {...props}
    />
  )
);
ConversationContent.displayName = "ConversationContent";

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;

export const ConversationScrollButton = memo(
  ({ className, ...props }: ConversationScrollButtonProps) => {
    const { isAtBottom, scrollToBottom } = useStickToBottomContext();

    const handleScrollToBottom = useCallback(() => {
      scrollToBottom();
    }, [scrollToBottom]);

    return (
      !isAtBottom && (
        <Button
          className={cn(
            "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",
            className
          )}
          onClick={handleScrollToBottom}
          size="icon"
          type="button"
          variant="outline"
          {...props}
        >
          <ArrowDownIcon className="size-4" />
        </Button>
      )
    );
  }
);
ConversationScrollButton.displayName = "ConversationScrollButton";
