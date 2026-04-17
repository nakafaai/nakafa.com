"use client";

import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import {
  Children,
  type ComponentProps,
  createContext,
  memo,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ScrollToIndexOpts,
  VList,
  type VListHandle,
  type VListProps,
} from "virtua";

export interface VirtualConversationHandle {
  findItemIndex: (offset: number) => number;
  getDistanceFromBottom: () => number;
  getItemOffset: (index: number) => number;
  getScrollOffset: () => number;
  isAtBottom: () => boolean;
  scrollToBottom: () => void;
  scrollToIndex: (index: number, options?: ScrollToIndexOpts) => void;
}

export const VIRTUAL_CONVERSATION_BOTTOM_THRESHOLD = 50;

interface VirtualConversationContextValue {
  isAtBottom: boolean;
  scrollButtonAction: () => void;
  scrollButtonAriaLabel: string;
  scrollToBottom: () => void;
}

const DEFAULT_SCROLL_BUTTON_ARIA_LABEL = "Scroll to bottom";

export type VirtualConversationAnchor =
  | {
      kind: "bottom";
    }
  | {
      align?: ScrollToIndexOpts["align"];
      index: number;
      kind: "index";
      offset?: number;
    };

const VirtualConversationContext =
  createContext<VirtualConversationContextValue | null>(null);

/** Reads the scroll controls for the active virtual conversation. */
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
  followLatest?: boolean;
  onInitialAnchorSettled?: () => void;
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  initialAnchor?: VirtualConversationAnchor;
  scrollRef?: RefObject<VirtualConversationHandle | null>;
  hideScrollButton?: boolean;
  scrollButtonAriaLabel?: string;
  scrollButtonAction?: () => void;
  floatingContent?: ReactNode;
  /**
   * Enable shift mode for reverse infinite scrolling.
   * When true, scroll position is maintained from END when items prepend.
   * Should be false when at bottom to avoid layout issues with new messages.
   */
  shift?: boolean;
};

/**
 * Renders one virtualized conversation list with measurement-aware initial
 * positioning and bottom pinning while the viewport height settles.
 */
export const VirtualConversation = memo(
  ({
    className,
    children,
    followLatest = true,
    onInitialAnchorSettled,
    onScroll,
    onScrollToTop,
    onScrollToBottom,
    initialAnchor = { kind: "bottom" },
    scrollRef,
    hideScrollButton = false,
    scrollButtonAriaLabel = DEFAULT_SCROLL_BUTTON_ARIA_LABEL,
    scrollButtonAction,
    floatingContent,
    shift = false,
    ...props
  }: VirtualConversationProps) => {
    const childCount = Children.count(children);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<VListHandle>(null);
    const [containerHeight, setContainerHeight] = useState(0);
    const [measurementVersion, setMeasurementVersion] = useState(0);
    const [isAtBottom, setIsAtBottom] = useState(
      initialAnchor.kind === "bottom"
    );
    const hasInitialAnchor = useRef(false);
    const hasNotifiedInitialAnchor = useRef(false);
    const isAtBottomRef = useRef(initialAnchor.kind === "bottom");
    const isBottomPinnedRef = useRef(initialAnchor.kind === "bottom");
    const hasScrolledToTop = useRef(false);
    const hasScrolledToBottom = useRef(false);
    const previousChildCount = useRef(childCount);
    const previousContainerHeight = useRef(0);
    const prevScrollOffset = useRef(0);

    /** Notifies consumers once the fresh-mount anchor has been applied. */
    const notifyInitialAnchorSettled = useCallback(() => {
      if (hasNotifiedInitialAnchor.current) {
        return;
      }

      hasNotifiedInitialAnchor.current = true;
      requestAnimationFrame(() => {
        onInitialAnchorSettled?.();
      });
    }, [onInitialAnchorSettled]);

    /** Scrolls the list to the latest item and pins future viewport resizes. */
    const scrollToBottom = useCallback(
      (smooth = true) => {
        if (!listRef.current || childCount === 0) {
          return;
        }

        isBottomPinnedRef.current = followLatest;
        listRef.current.scrollToIndex(childCount - 1, {
          align: "end",
          smooth,
        });
      },
      [childCount, followLatest]
    );

    /** Measures the current distance from the live bottom edge. */
    const measureDistanceFromBottom = useCallback((offset?: number) => {
      if (!listRef.current) {
        return Number.POSITIVE_INFINITY;
      }

      return Math.max(
        0,
        listRef.current.scrollSize -
          (offset ?? listRef.current.scrollOffset) -
          listRef.current.viewportSize
      );
    }, []);

    /** Scrolls to one item index without enabling bottom pinning. */
    const scrollToIndex = useCallback(
      (index: number, options?: ScrollToIndexOpts) => {
        if (!listRef.current) {
          return;
        }

        isBottomPinnedRef.current = false;
        listRef.current.scrollToIndex(index, options);
      },
      []
    );

    /** Applies the first anchor only after the list has measurable geometry. */
    const applyInitialAnchor = useCallback(() => {
      if (
        hasInitialAnchor.current ||
        !listRef.current ||
        childCount === 0 ||
        containerHeight === 0 ||
        listRef.current.viewportSize === 0
      ) {
        return;
      }

      hasInitialAnchor.current = true;

      if (initialAnchor.kind === "bottom") {
        scrollToBottom(false);
        notifyInitialAnchorSettled();
        return;
      }

      scrollToIndex(initialAnchor.index, {
        align: initialAnchor.align,
        offset: initialAnchor.offset,
      });
      notifyInitialAnchorSettled();
    }, [
      childCount,
      containerHeight,
      initialAnchor,
      notifyInitialAnchorSettled,
      scrollToBottom,
      scrollToIndex,
    ]);

    useLayoutEffect(() => {
      if (!containerRef.current) {
        return;
      }

      const node = containerRef.current;
      setContainerHeight(node.getBoundingClientRect().height);
      setMeasurementVersion((version) => version + 1);

      if (typeof ResizeObserver === "undefined") {
        return;
      }

      const observer = new ResizeObserver(([entry]) => {
        if (!entry) {
          return;
        }

        setContainerHeight(entry.contentRect.height);
        setMeasurementVersion((version) => version + 1);
      });
      observer.observe(node);

      return () => {
        observer.disconnect();
      };
    }, []);

    useLayoutEffect(() => {
      if (measurementVersion === 0) {
        return;
      }

      applyInitialAnchor();
    }, [applyInitialAnchor, measurementVersion]);

    useLayoutEffect(() => {
      if (previousContainerHeight.current === containerHeight) {
        return;
      }

      previousContainerHeight.current = containerHeight;

      if (
        !(followLatest && hasInitialAnchor.current && isBottomPinnedRef.current)
      ) {
        return;
      }

      scrollToBottom(false);
    }, [containerHeight, followLatest, scrollToBottom]);

    useLayoutEffect(() => {
      if (previousChildCount.current === childCount) {
        return;
      }

      previousChildCount.current = childCount;

      if (
        !(followLatest && hasInitialAnchor.current && isBottomPinnedRef.current)
      ) {
        return;
      }

      scrollToBottom(false);
    }, [childCount, followLatest, scrollToBottom]);

    useLayoutEffect(() => {
      if (!(followLatest && isAtBottomRef.current)) {
        isBottomPinnedRef.current = false;
        return;
      }

      isBottomPinnedRef.current = true;
    }, [followLatest]);

    const handleScroll = useCallback(
      (offset: number) => {
        if (listRef.current) {
          const distanceFromBottom = measureDistanceFromBottom(offset);
          const atBottom =
            distanceFromBottom < VIRTUAL_CONVERSATION_BOTTOM_THRESHOLD;
          isAtBottomRef.current = atBottom;
          isBottomPinnedRef.current = followLatest && atBottom;
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
      [
        followLatest,
        measureDistanceFromBottom,
        onScroll,
        onScrollToTop,
        onScrollToBottom,
      ]
    );

    const contextValue = useMemo(
      () => ({
        isAtBottom,
        scrollButtonAriaLabel,
        scrollButtonAction: scrollButtonAction ?? scrollToBottom,
        scrollToBottom,
      }),
      [isAtBottom, scrollButtonAction, scrollButtonAriaLabel, scrollToBottom]
    );

    useImperativeHandle(
      scrollRef,
      () => ({
        findItemIndex: (offset: number) =>
          listRef.current?.findItemIndex(offset) ?? 0,
        getDistanceFromBottom: () => measureDistanceFromBottom(),
        getItemOffset: (index: number) =>
          listRef.current?.getItemOffset(index) ?? 0,
        getScrollOffset: () => listRef.current?.scrollOffset ?? 0,
        scrollToIndex,
        scrollToBottom,
        isAtBottom: () => isAtBottomRef.current,
      }),
      [measureDistanceFromBottom, scrollToIndex, scrollToBottom]
    );

    return (
      <VirtualConversationContext.Provider value={contextValue}>
        <div className="relative flex-1 overflow-hidden" ref={containerRef}>
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

/** Renders the floating "scroll to bottom" affordance for the active list. */
export const VirtualConversationScrollButton = memo(
  ({ className, ...props }: VirtualConversationScrollButtonProps) => {
    const { isAtBottom, scrollButtonAction, scrollButtonAriaLabel } =
      useVirtualConversation();

    if (isAtBottom) {
      return null;
    }

    return (
      <Button
        aria-label={scrollButtonAriaLabel}
        className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full",
          className
        )}
        onClick={scrollButtonAction}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <HugeIcons icon={ArrowDown02Icon} />
        <span className="sr-only">{scrollButtonAriaLabel}</span>
      </Button>
    );
  }
);
VirtualConversationScrollButton.displayName = "VirtualConversationScrollButton";

/** Renders one empty conversation viewport while initial data loads. */
export const VirtualConversationPlaceholder = memo(
  ({ className, ...props }: ComponentProps<"div">) => (
    <div
      className={cn("relative flex-1 overflow-hidden", className)}
      {...props}
    />
  )
);
VirtualConversationPlaceholder.displayName = "VirtualConversationPlaceholder";
