"use client";

import { ArrowDown02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { cn } from "@repo/design-system/lib/utils";
import type {
  VirtualConversationAnchor,
  VirtualConversationHandle,
  VirtualScrollToIndexOptions,
} from "@repo/design-system/types/virtual";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
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

const DEFAULT_ESTIMATED_ITEM_SIZE = 120;
const DEFAULT_SCROLL_BUTTON_ARIA_LABEL = "Scroll to bottom";
const VIRTUAL_CONVERSATION_BOTTOM_EPSILON = 2;
const INDEX_ANCHOR_SETTLE_EPSILON = 2;

interface VirtualConversationContextValue {
  isAtBottom: boolean;
  scrollButtonAction: () => void;
  scrollButtonAriaLabel: string;
}

const VirtualConversationContext =
  createContext<VirtualConversationContextValue | null>(null);

/** Returns whether the measured distance should count as the exact bottom edge. */
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

/** Returns one absolute measurement for the given item index, if known. */
function getMeasuredVirtualItem(
  measurements: VirtualItem[],
  index: number
): VirtualItem | null {
  return measurements[index] ?? null;
}

/** Resolves one target scroll offset for the requested item alignment. */
function getScrollOffsetForItem({
  item,
  offset,
  scrollHeight,
  viewportHeight,
  align,
}: {
  item: VirtualItem;
  offset: number;
  scrollHeight: number;
  viewportHeight: number;
  align: NonNullable<VirtualScrollToIndexOptions["align"]>;
}) {
  const maxScrollTop = Math.max(0, scrollHeight - viewportHeight);
  let scrollTop = item.start - offset;

  if (align === "center") {
    scrollTop = item.start - (viewportHeight - item.size) / 2 + offset;
  }

  if (align === "end") {
    scrollTop = item.end - viewportHeight + offset;
  }

  if (align === "auto") {
    const itemTop = item.start;
    const itemBottom = item.end;
    const currentTop = 0;
    const currentBottom = viewportHeight;

    if (itemTop >= currentTop && itemBottom <= currentBottom) {
      scrollTop = item.start - offset;
    } else if (itemTop < currentTop) {
      scrollTop = item.start - offset;
    } else {
      scrollTop = item.end - viewportHeight + offset;
    }
  }

  return Math.min(Math.max(0, scrollTop), maxScrollTop);
}

export type VirtualConversationProps = Omit<
  ComponentProps<"div">,
  "children" | "onScroll"
> & {
  children: ReactNode;
  containerRef?: RefObject<HTMLDivElement | null>;
  estimateSize?: (index: number) => number;
  floatingContent?: ReactNode;
  followLatest?: boolean;
  hideScrollButton?: boolean;
  initialAnchor?: VirtualConversationAnchor | null;
  onInitialAnchorSettled?: () => void;
  onScroll?: (offset: number) => void;
  onScrollEnd?: () => void;
  overscan?: number;
  scrollButtonAction?: () => void;
  scrollButtonAriaLabel?: string;
  scrollRef?: RefObject<VirtualConversationHandle | null>;
};

/** Renders one virtualized conversation list powered by TanStack Virtual. */
export const VirtualConversation = memo(
  ({
    className,
    children,
    containerRef,
    estimateSize,
    floatingContent,
    followLatest = true,
    hideScrollButton = false,
    initialAnchor = null,
    onInitialAnchorSettled,
    onScroll,
    onScrollEnd,
    overscan = 6,
    scrollButtonAction,
    scrollButtonAriaLabel = DEFAULT_SCROLL_BUTTON_ARIA_LABEL,
    scrollRef,
    ...props
  }: VirtualConversationProps) => {
    const items = useMemo(() => Children.toArray(children), [children]);
    const itemKeys = useMemo(
      () =>
        items.map((item, index) => {
          if (
            typeof item === "object" &&
            item &&
            "key" in item &&
            item.key != null
          ) {
            return String(item.key);
          }

          return String(index);
        }),
      [items]
    );
    const scrollElementRef = useRef<HTMLDivElement>(null);
    const pendingInitialAnchorRef = useRef<VirtualConversationAnchor | null>(
      initialAnchor
    );
    const hasInitialAnchorRef = useRef(false);
    const hasNotifiedInitialAnchorRef = useRef(false);
    const isAtBottomRef = useRef(initialAnchor?.kind === "bottom");
    const isBottomPinnedRef = useRef(initialAnchor?.kind === "bottom");
    const hasPendingBottomSettleRef = useRef(false);
    const lastNotifiedScrollRef = useRef<{
      isScrolling: boolean;
      offset: number;
    } | null>(null);
    const previousContainerHeightRef = useRef(0);
    const previousItemCountRef = useRef(items.length);
    const [isAtBottom, setIsAtBottom] = useState(
      initialAnchor?.kind === "bottom"
    );
    const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
      count: items.length,
      estimateSize: estimateSize ?? (() => DEFAULT_ESTIMATED_ITEM_SIZE),
      getItemKey: (index) => itemKeys[index] ?? index,
      getScrollElement: () => scrollElementRef.current,
      overscan,
      useAnimationFrameWithResizeObserver: false,
      useScrollendEvent: false,
    });
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (
      item,
      _delta,
      instance
    ) =>
      instance.scrollDirection === "backward" &&
      item.start < (instance.scrollOffset ?? 0);
    const virtualItems = virtualizer.getVirtualItems();
    const paddingTop = virtualItems[0]?.start ?? 0;
    const scrollOffset = virtualizer.scrollOffset ?? 0;
    const totalSize = virtualizer.getTotalSize();
    const viewportHeight = virtualizer.scrollRect?.height ?? 0;
    const geometryVersion = `${scrollOffset}:${totalSize}:${viewportHeight}`;
    /** Writes both the internal and forwarded scroll container refs. */
    const setScrollElementRef = useCallback(
      (node: HTMLDivElement | null) => {
        scrollElementRef.current = node;

        if (!containerRef) {
          return;
        }

        containerRef.current = node;
      },
      [containerRef]
    );

    /** Measures the current distance between the viewport and the bottom edge. */
    const getDistanceFromBottom = useCallback(() => {
      const viewportHeight = virtualizer.scrollRect?.height ?? 0;
      const scrollOffset = virtualizer.scrollOffset ?? 0;

      return Math.max(
        0,
        virtualizer.getTotalSize() - viewportHeight - scrollOffset
      );
    }, [virtualizer]);

    /** Syncs the bottom state and followLatest pinning from current measurements. */
    const syncBottomState = useCallback(() => {
      const atBottom = isAtConversationBottom(getDistanceFromBottom());

      isAtBottomRef.current = atBottom;

      if (!hasPendingBottomSettleRef.current || atBottom) {
        isBottomPinnedRef.current = followLatest && atBottom;
      }

      setIsAtBottom((currentIsAtBottom) =>
        currentIsAtBottom === atBottom ? currentIsAtBottom : atBottom
      );

      if (atBottom) {
        hasPendingBottomSettleRef.current = false;
      }

      return atBottom;
    }, [followLatest, getDistanceFromBottom]);

    /** Scrolls to one item index using measured TanStack offsets plus local offset. */
    const scrollToIndex = useCallback(
      (index: number, options?: VirtualScrollToIndexOptions) => {
        const measurement = getMeasuredVirtualItem(
          virtualizer.measurementsCache,
          index
        );
        const container = scrollElementRef.current;

        if (!(measurement && container)) {
          virtualizer.scrollToIndex(index, {
            align: options?.align,
            behavior: options?.smooth ? "smooth" : "auto",
          });
          return true;
        }

        hasPendingBottomSettleRef.current = false;
        isBottomPinnedRef.current = false;
        virtualizer.scrollToOffset(
          getScrollOffsetForItem({
            align: options?.align ?? "start",
            item: measurement,
            offset: options?.offset ?? 0,
            scrollHeight: virtualizer.getTotalSize(),
            viewportHeight: container.clientHeight,
          }),
          { behavior: options?.smooth ? "smooth" : "auto" }
        );
        return true;
      },
      [virtualizer]
    );

    /** Scrolls to one absolute offset using TanStack's public scroll API. */
    const scrollToOffset = useCallback(
      (offset: number, smooth = false) => {
        virtualizer.scrollToOffset(offset, {
          behavior: smooth ? "smooth" : "auto",
        });
        return true;
      },
      [virtualizer]
    );

    /** Scrolls the list to its latest edge and arms bottom pinning. */
    const scrollToBottom = useCallback(
      (smooth = true) => {
        if (items.length === 0) {
          return false;
        }

        hasPendingBottomSettleRef.current = true;
        isBottomPinnedRef.current = followLatest;
        virtualizer.scrollToIndex(items.length - 1, {
          align: "end",
          behavior: smooth ? "smooth" : "auto",
        });
        return true;
      },
      [followLatest, items.length, virtualizer]
    );

    /** Finalizes the first anchor once it has visibly landed. */
    const maybeSettleInitialAnchor = useCallback(() => {
      const pendingInitialAnchor = pendingInitialAnchorRef.current;

      if (!(pendingInitialAnchor && scrollElementRef.current)) {
        return true;
      }

      if (pendingInitialAnchor.kind === "bottom") {
        if (!isAtConversationBottom(getDistanceFromBottom())) {
          scrollToBottom(false);
          return false;
        }

        pendingInitialAnchorRef.current = null;
        return true;
      }

      const measurement = getMeasuredVirtualItem(
        virtualizer.measurementsCache,
        pendingInitialAnchor.index
      );

      if (!measurement) {
        return false;
      }

      const expectedOffset = getScrollOffsetForItem({
        align: pendingInitialAnchor.align ?? "start",
        item: measurement,
        offset: pendingInitialAnchor.offset ?? 0,
        scrollHeight: virtualizer.getTotalSize(),
        viewportHeight: scrollElementRef.current.clientHeight,
      });

      if (
        Math.abs((virtualizer.scrollOffset ?? 0) - expectedOffset) <=
        INDEX_ANCHOR_SETTLE_EPSILON
      ) {
        pendingInitialAnchorRef.current = null;
        return true;
      }

      scrollToIndex(pendingInitialAnchor.index, {
        align: pendingInitialAnchor.align,
        offset: pendingInitialAnchor.offset,
        smooth: false,
      });
      return false;
    }, [getDistanceFromBottom, scrollToBottom, scrollToIndex, virtualizer]);

    /** Notifies consumers once the fresh transcript anchor is visibly ready. */
    const notifyInitialAnchorSettled = useCallback(() => {
      if (hasNotifiedInitialAnchorRef.current) {
        return;
      }

      hasNotifiedInitialAnchorRef.current = true;
      requestAnimationFrame(() => {
        onInitialAnchorSettled?.();
      });
    }, [onInitialAnchorSettled]);

    /** Applies the first anchor after the scroll container becomes measurable. */
    useLayoutEffect(() => {
      const container = scrollElementRef.current;

      if (
        hasInitialAnchorRef.current ||
        !container ||
        items.length === 0 ||
        container.clientHeight === 0 ||
        virtualizer.scrollRect?.height === 0
      ) {
        return;
      }

      hasInitialAnchorRef.current = true;
      pendingInitialAnchorRef.current = initialAnchor;

      if (!initialAnchor) {
        hasInitialAnchorRef.current = true;
        notifyInitialAnchorSettled();
        return;
      }

      if (initialAnchor.kind === "bottom") {
        scrollToBottom(false);
        return;
      }

      scrollToIndex(initialAnchor.index, {
        align: initialAnchor.align,
        offset: initialAnchor.offset,
        smooth: false,
      });
    }, [
      initialAnchor,
      items.length,
      notifyInitialAnchorSettled,
      scrollToBottom,
      scrollToIndex,
      virtualizer.scrollRect?.height,
    ]);

    /** Keeps the initial anchor honest while measured item sizes settle. */
    useLayoutEffect(() => {
      if (geometryVersion === "") {
        return;
      }

      if (!hasInitialAnchorRef.current) {
        return;
      }

      if (!maybeSettleInitialAnchor()) {
        return;
      }

      notifyInitialAnchorSettled();
    }, [geometryVersion, maybeSettleInitialAnchor, notifyInitialAnchorSettled]);

    /** Re-pins the latest edge when the viewport grows while followLatest is armed. */
    useLayoutEffect(() => {
      const containerHeight = virtualizer.scrollRect?.height ?? 0;

      if (previousContainerHeightRef.current === containerHeight) {
        return;
      }

      previousContainerHeightRef.current = containerHeight;

      if (
        !(
          followLatest &&
          hasInitialAnchorRef.current &&
          isBottomPinnedRef.current
        )
      ) {
        return;
      }

      scrollToBottom(false);
    }, [followLatest, scrollToBottom, virtualizer.scrollRect?.height]);

    /** Re-pins the latest edge when new rows land while followLatest is armed. */
    useLayoutEffect(() => {
      if (previousItemCountRef.current === items.length) {
        return;
      }

      previousItemCountRef.current = items.length;

      if (
        !(
          followLatest &&
          hasInitialAnchorRef.current &&
          isBottomPinnedRef.current
        )
      ) {
        return;
      }

      scrollToBottom(false);
    }, [followLatest, items.length, scrollToBottom]);

    /** Keeps the live-bottom state in sync with measured geometry. */
    useLayoutEffect(() => {
      if (geometryVersion === "") {
        return;
      }

      syncBottomState();
    }, [geometryVersion, syncBottomState]);

    /** Emits scroll callbacks only when the virtualizer's scroll state actually changes. */
    useLayoutEffect(() => {
      const nextScrollState = {
        isScrolling: virtualizer.isScrolling,
        offset: scrollOffset,
      };
      const previousScrollState = lastNotifiedScrollRef.current;

      if (
        previousScrollState?.isScrolling === nextScrollState.isScrolling &&
        previousScrollState.offset === nextScrollState.offset
      ) {
        return;
      }

      lastNotifiedScrollRef.current = nextScrollState;
      onScroll?.(nextScrollState.offset);

      if (!nextScrollState.isScrolling) {
        onScrollEnd?.();
      }
    }, [onScroll, onScrollEnd, scrollOffset, virtualizer.isScrolling]);

    const contextValue = useMemo(
      () => ({
        isAtBottom,
        scrollButtonAriaLabel,
        scrollButtonAction:
          scrollButtonAction ??
          (() => {
            scrollToBottom();
          }),
      }),
      [isAtBottom, scrollButtonAction, scrollButtonAriaLabel, scrollToBottom]
    );

    useImperativeHandle(
      scrollRef,
      () => ({
        findItemIndex: (offset: number) =>
          virtualizer.getVirtualItemForOffset(offset)?.index ?? 0,
        getDistanceFromBottom,
        getItemOffset: (index: number) =>
          getMeasuredVirtualItem(virtualizer.measurementsCache, index)?.start ??
          0,
        getItemSize: (index: number) =>
          getMeasuredVirtualItem(virtualizer.measurementsCache, index)?.size ??
          0,
        getScrollOffset: () => virtualizer.scrollOffset ?? 0,
        getViewportSize: () => virtualizer.scrollRect?.height ?? 0,
        isAtBottom: () => isAtBottomRef.current,
        scrollToBottom,
        scrollToIndex,
        scrollToOffset,
      }),
      [
        getDistanceFromBottom,
        scrollToBottom,
        scrollToIndex,
        scrollToOffset,
        virtualizer,
      ]
    );

    return (
      <VirtualConversationContext.Provider value={contextValue}>
        <div className="relative flex-1 overflow-hidden">
          <div
            className={cn(
              "scrollbar-hide size-full overflow-y-auto",
              className
            )}
            ref={setScrollElementRef}
            {...props}
          >
            <div
              style={{
                height: totalSize,
                position: "relative",
                width: "100%",
              }}
            >
              <div
                style={{
                  transform: `translateY(${paddingTop}px)`,
                  width: "100%",
                }}
              >
                {virtualItems.map((virtualItem) => (
                  <div
                    data-index={virtualItem.index}
                    key={virtualItem.key}
                    ref={virtualizer.measureElement}
                    style={{ display: "flow-root", width: "100%" }}
                  >
                    {items[virtualItem.index]}
                  </div>
                ))}
              </div>
            </div>
          </div>

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
    >
      <div className="flex size-full items-center justify-center text-muted-foreground">
        <Spinner className="size-5" />
      </div>
    </div>
  )
);
VirtualConversationPlaceholder.displayName = "VirtualConversationPlaceholder";
