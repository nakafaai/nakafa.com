"use client";

import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";
import {
  getIndexAnchorOffset,
  isIndexAnchorSettled,
} from "@repo/design-system/lib/virtual-anchor";
import type {
  VirtualConversationAnchor,
  VirtualConversationHandle,
} from "@repo/design-system/types/virtual";
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

const VIRTUAL_CONVERSATION_BOTTOM_EPSILON = 2;

interface VirtualConversationContextValue {
  isAtBottom: boolean;
  scrollButtonAction: () => void;
  scrollButtonAriaLabel: string;
}

const DEFAULT_SCROLL_BUTTON_ARIA_LABEL = "Scroll to bottom";

const VirtualConversationContext =
  createContext<VirtualConversationContextValue | null>(null);

/** Returns whether one measured distance should count as the exact bottom edge. */
function isAtConversationBottom(distanceFromBottom: number) {
  return distanceFromBottom <= VIRTUAL_CONVERSATION_BOTTOM_EPSILON;
}

/** Reads the scroll controls for the active virtual conversation. */
function useVirtualConversation() {
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
    onScrollEnd,
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
    const hasPendingBottomSettleRef = useRef(false);
    const hasPendingInitialBottomAnchorRef = useRef(false);
    const pendingInitialIndexAnchorRef = useRef<Extract<
      VirtualConversationAnchor,
      { kind: "index" }
    > | null>(null);
    const previousChildCount = useRef(childCount);
    const previousContainerHeight = useRef(0);

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

    /** Finalizes one pending bottom scroll and notifies any waiting initial anchor. */
    const settlePendingBottomScroll = useCallback(() => {
      hasPendingBottomSettleRef.current = false;

      if (!hasPendingInitialBottomAnchorRef.current) {
        return;
      }

      hasPendingInitialBottomAnchorRef.current = false;
      notifyInitialAnchorSettled();
    }, [notifyInitialAnchorSettled]);

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

    /** Synchronizes the exact-bottom state from the current measured geometry. */
    const syncBottomState = useCallback(
      (offset?: number) => {
        const distanceFromBottom = measureDistanceFromBottom(offset);
        const atBottom = isAtConversationBottom(distanceFromBottom);

        isAtBottomRef.current = atBottom;

        if (!hasPendingBottomSettleRef.current || atBottom) {
          isBottomPinnedRef.current = followLatest && atBottom;
        }

        setIsAtBottom(atBottom);

        if (atBottom) {
          settlePendingBottomScroll();
        }

        return atBottom;
      },
      [followLatest, measureDistanceFromBottom, settlePendingBottomScroll]
    );

    /** Scrolls the list to the latest item and pins future viewport resizes. */
    const scrollToBottom = useCallback(
      (smooth = true) => {
        if (!listRef.current || childCount === 0) {
          return;
        }

        hasPendingBottomSettleRef.current = true;
        isBottomPinnedRef.current = followLatest;
        listRef.current.scrollToIndex(childCount - 1, {
          align: "end",
          smooth,
        });
        requestAnimationFrame(() => {
          syncBottomState();
        });
      },
      [childCount, followLatest, syncBottomState]
    );

    /** Scrolls to one item index without enabling bottom pinning. */
    const scrollToIndex = useCallback(
      (index: number, options?: ScrollToIndexOpts) => {
        if (!listRef.current) {
          return;
        }

        hasPendingBottomSettleRef.current = false;
        hasPendingInitialBottomAnchorRef.current = false;
        isBottomPinnedRef.current = false;
        listRef.current.scrollToIndex(index, options);
      },
      []
    );

    /** Finalizes one pending exact index anchor after measurement catches up. */
    const settlePendingIndexAnchor = useCallback(() => {
      const anchor = pendingInitialIndexAnchorRef.current;

      if (!(anchor && listRef.current)) {
        return true;
      }

      const expectedOffset = getIndexAnchorOffset({
        anchor,
        itemOffset: listRef.current.getItemOffset(anchor.index),
      });

      if (expectedOffset === null) {
        pendingInitialIndexAnchorRef.current = null;
        notifyInitialAnchorSettled();
        return true;
      }

      if (
        isIndexAnchorSettled({
          actualOffset: listRef.current.scrollOffset,
          expectedOffset,
        })
      ) {
        pendingInitialIndexAnchorRef.current = null;
        notifyInitialAnchorSettled();
        return true;
      }

      requestAnimationFrame(() => {
        scrollToIndex(anchor.index, {
          align: anchor.align,
          offset: anchor.offset,
        });
      });
      return false;
    }, [notifyInitialAnchorSettled, scrollToIndex]);

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
        hasPendingInitialBottomAnchorRef.current = true;
        scrollToBottom(false);
        return;
      }

      pendingInitialIndexAnchorRef.current = initialAnchor;
      scrollToIndex(initialAnchor.index, {
        align: initialAnchor.align,
        offset: initialAnchor.offset,
      });
      requestAnimationFrame(() => {
        settlePendingIndexAnchor();
      });
    }, [
      childCount,
      containerHeight,
      initialAnchor,
      settlePendingIndexAnchor,
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
      settlePendingIndexAnchor();
    }, [applyInitialAnchor, measurementVersion, settlePendingIndexAnchor]);

    useLayoutEffect(() => {
      if (previousContainerHeight.current === containerHeight) {
        return;
      }

      previousContainerHeight.current = containerHeight;

      if (
        !(followLatest && hasInitialAnchor.current && isBottomPinnedRef.current)
      ) {
        settlePendingIndexAnchor();
        return;
      }

      scrollToBottom(false);
    }, [
      containerHeight,
      followLatest,
      scrollToBottom,
      settlePendingIndexAnchor,
    ]);

    useLayoutEffect(() => {
      if (previousChildCount.current === childCount) {
        return;
      }

      previousChildCount.current = childCount;

      if (
        !(followLatest && hasInitialAnchor.current && isBottomPinnedRef.current)
      ) {
        settlePendingIndexAnchor();
        return;
      }

      scrollToBottom(false);
    }, [childCount, followLatest, scrollToBottom, settlePendingIndexAnchor]);

    useLayoutEffect(() => {
      if (
        !(
          followLatest &&
          (isAtBottomRef.current || hasPendingBottomSettleRef.current)
        )
      ) {
        isBottomPinnedRef.current = false;
        return;
      }

      isBottomPinnedRef.current = true;
    }, [followLatest]);

    const handleScroll = useCallback(
      (offset: number) => {
        if (listRef.current) {
          syncBottomState(offset);
        }

        onScroll?.(offset);
      },
      [onScroll, syncBottomState]
    );

    /** Retries bottom alignment until the exact bottom anchor has truly settled. */
    const handleScrollEnd = useCallback(() => {
      const atBottom = syncBottomState();

      if (hasPendingBottomSettleRef.current && !atBottom && childCount > 0) {
        requestAnimationFrame(() => {
          scrollToBottom(false);
        });
        return;
      }

      if (!settlePendingIndexAnchor()) {
        return;
      }

      onScrollEnd?.();
    }, [
      childCount,
      onScrollEnd,
      scrollToBottom,
      settlePendingIndexAnchor,
      syncBottomState,
    ]);

    const contextValue = useMemo(
      () => ({
        isAtBottom,
        scrollButtonAriaLabel,
        scrollButtonAction: scrollButtonAction ?? scrollToBottom,
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
        getViewportSize: () => listRef.current?.viewportSize ?? 0,
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
            onScrollEnd={handleScrollEnd}
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

type VirtualConversationScrollButtonProps = ComponentProps<typeof Button>;

/** Renders the floating "scroll to bottom" affordance for the active list. */
const VirtualConversationScrollButton = memo(
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
