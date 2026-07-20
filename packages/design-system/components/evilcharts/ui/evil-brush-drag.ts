import type { EvilBrushRange } from "@repo/design-system/components/evilcharts/ui/evil-brush";
import {
  type PointerEventHandler,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useRef,
} from "react";

type DragType = "left" | "right" | "middle";

/** Pointer handlers attached to one brush handle or the selected region. */
interface BrushPointerBindings {
  onLostPointerCapture: PointerEventHandler<HTMLElement>;
  onPointerCancel: PointerEventHandler<HTMLElement>;
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
}

/** Creates pointer handlers for one movable part of the brush. */
type BrushBindingFactory = (type: DragType) => BrushPointerBindings;

interface DragState {
  originRange: EvilBrushRange;
  originX: number;
  type: DragType;
}

interface UseBrushDragOptions {
  commit: (next: EvilBrushRange, mode?: DragType) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  range: EvilBrushRange;
  totalPoints: number;
}

/**
 * Converts captured pointer movement into range updates for either handle or
 * the selected region. Pointer capture keeps mouse, touch, and pen drags on the
 * originating element without global listeners.
 */
function useBrushDrag({
  range,
  totalPoints,
  containerRef,
  commit,
}: UseBrushDragOptions) {
  const dragRef = useRef<DragState | null>(null);

  const toIndexDelta = useCallback(
    (pixels: number) => {
      const container = containerRef.current;
      if (!container || totalPoints <= 1) {
        return 0;
      }

      return Math.round(
        (pixels / container.getBoundingClientRect().width) * (totalPoints - 1)
      );
    },
    [containerRef, totalPoints]
  );

  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>, type: DragType) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        originRange: { ...range },
        originX: event.clientX,
        type,
      };
    },
    [range]
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const delta = toIndexDelta(event.clientX - drag.originX);
      const { originRange, type } = drag;

      if (type === "left") {
        commit(
          {
            startIndex: originRange.startIndex + delta,
            endIndex: originRange.endIndex,
          },
          "left"
        );
        return;
      }

      if (type === "right") {
        commit(
          {
            startIndex: originRange.startIndex,
            endIndex: originRange.endIndex + delta,
          },
          "right"
        );
        return;
      }

      const span = originRange.endIndex - originRange.startIndex;
      let startIndex = originRange.startIndex + delta;
      let endIndex = startIndex + span;

      if (startIndex < 0) {
        startIndex = 0;
        endIndex = span;
      }

      if (endIndex > totalPoints - 1) {
        endIndex = totalPoints - 1;
        startIndex = Math.max(0, endIndex - span);
      }

      commit({ startIndex, endIndex }, "middle");
    },
    [commit, toIndexDelta, totalPoints]
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
  }, []);

  const bind = useCallback(
    (type: DragType) => ({
      onLostPointerCapture: endDrag,
      onPointerCancel: endDrag,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) =>
        startDrag(event, type),
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
    }),
    [endDrag, moveDrag, startDrag]
  );

  return { bind };
}

export {
  type BrushBindingFactory,
  type BrushPointerBindings,
  type DragType,
  useBrushDrag,
};
