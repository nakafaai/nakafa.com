"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { ArrowDownIcon } from "lucide-react";
import React, {
  type ComponentProps,
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { VList, type VListHandle, type VListProps } from "virtua";

export type VirtualConversationHandle = {
  scrollToIndex: (index: number) => void;
  scrollToBottom: () => void;
  isAtBottom: () => boolean;
};

type VirtualConversationContextValue = {
  scrollToBottom: () => void;
  scrollToIndex: (index: number) => void;
  isAtBottom: boolean;
};

const VirtualConversationContext =
  createContext<VirtualConversationContextValue | null>(null);

export function useVirtualConversation() {
  const context = useContext(VirtualConversationContext);
  if (!context) {
    throw new Error(
      "useVirtualConversation must be used within VirtualConversation"
    );
  }
  return context;
}

export type VirtualConversationProps = Omit<VListProps, "ref" | "shift"> & {
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  initialScroll?: number | "end";
  scrollRef?: React.RefObject<VirtualConversationHandle | null>;
  hideScrollButton?: boolean;
  floatingContent?: React.ReactNode;
  /**
   * Enable shift mode for reverse infinite scrolling.
   * When true, scroll position is maintained from END when items prepend.
   * Should be false when at bottom to avoid layout issues with new messages.
   */
  shift?: boolean;
};

export const VirtualConversation = memo(
  ({
    className,
    children,
    onScroll,
    onScrollToTop,
    onScrollToBottom,
    initialScroll = "end",
    scrollRef,
    hideScrollButton = false,
    floatingContent,
    shift = false,
    ...props
  }: VirtualConversationProps) => {
    const listRef = useRef<VListHandle>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const isAtBottomRef = useRef(true);
    const hasScrolledToTop = useRef(false);
    const hasScrolledToBottom = useRef(false);
    const hasInitialScrolled = useRef(false);
    const prevScrollOffset = useRef(0);

    // Initial scroll
    useEffect(() => {
      if (hasInitialScrolled.current || !listRef.current) {
        return;
      }
      hasInitialScrolled.current = true;

      if (initialScroll === "end") {
        listRef.current.scrollToIndex(listRef.current.scrollSize, {
          align: "end",
        });
      } else {
        listRef.current.scrollToIndex(initialScroll, { align: "center" });
      }
    }, [initialScroll]);

    const handleScroll = useCallback(
      (offset: number) => {
        if (listRef.current) {
          const { scrollSize, viewportSize } = listRef.current;
          const distanceFromBottom = scrollSize - offset - viewportSize;
          const atBottom = distanceFromBottom < 50;
          isAtBottomRef.current = atBottom;
          setIsAtBottom(atBottom);

          // Track scroll direction
          const isScrollingUp = offset < prevScrollOffset.current;
          const isScrollingDown = offset > prevScrollOffset.current;
          prevScrollOffset.current = offset;

          // Trigger onScrollToTop when scrolling UP near top
          if (offset < 100 && isScrollingUp && !hasScrolledToTop.current) {
            hasScrolledToTop.current = true;
            onScrollToTop?.();
          } else if (offset >= 100) {
            hasScrolledToTop.current = false;
          }

          // Trigger onScrollToBottom when scrolling DOWN near bottom
          if (atBottom && isScrollingDown && !hasScrolledToBottom.current) {
            hasScrolledToBottom.current = true;
            onScrollToBottom?.();
          } else if (!atBottom) {
            hasScrolledToBottom.current = false;
          }
        }
        onScroll?.(offset);
      },
      [onScroll, onScrollToTop, onScrollToBottom]
    );

    const scrollToBottom = useCallback(() => {
      if (listRef.current) {
        listRef.current.scrollToIndex(listRef.current.scrollSize, {
          align: "end",
          smooth: true,
        });
      }
    }, []);

    const scrollToIndex = useCallback((index: number) => {
      if (listRef.current) {
        listRef.current.scrollToIndex(index, { align: "center" });
      }
    }, []);

    useImperativeHandle(
      scrollRef,
      () => ({
        scrollToIndex,
        scrollToBottom,
        isAtBottom: () => isAtBottomRef.current,
      }),
      [scrollToIndex, scrollToBottom]
    );

    return (
      <VirtualConversationContext.Provider
        value={{ scrollToBottom, scrollToIndex, isAtBottom }}
      >
        <div className="relative flex-1 overflow-hidden">
          <VList
            className={cn("scrollbar-hide size-full", className)}
            onScroll={handleScroll}
            ref={listRef}
            shift={shift}
            {...props}
          >
            {children}
          </VList>
          <VirtualConversationScrollButton
            className={cn(!!hideScrollButton && "hidden")}
          />
          {floatingContent}
        </div>
      </VirtualConversationContext.Provider>
    );
  }
);
VirtualConversation.displayName = "VirtualConversation";

export type VirtualConversationScrollButtonProps = ComponentProps<
  typeof Button
>;

export const VirtualConversationScrollButton = memo(
  ({ className, ...props }: VirtualConversationScrollButtonProps) => {
    const { isAtBottom, scrollToBottom } = useVirtualConversation();

    if (isAtBottom) {
      return null;
    }

    return (
      <Button
        className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full",
          className
        )}
        onClick={scrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    );
  }
);
VirtualConversationScrollButton.displayName = "VirtualConversationScrollButton";

export const VirtualConversationPlaceholder = memo(
  ({ className, ...props }: ComponentProps<"div">) => (
    <div
      className={cn("relative flex-1 overflow-hidden", className)}
      {...props}
    />
  )
);
VirtualConversationPlaceholder.displayName = "VirtualConversationPlaceholder";
