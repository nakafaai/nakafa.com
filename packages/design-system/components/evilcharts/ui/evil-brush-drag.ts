import type { EvilBrushRange } from "@repo/design-system/components/evilcharts/ui/evil-brush";
import { Schema } from "effect";
import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useRef,
} from "react";

const DragTypeSchema = Schema.Literals(["left", "right", "middle"]);
type DragType = typeof DragTypeSchema.Type;

const DragStateSchema = Schema.Struct({
  originEndIndex: Schema.Finite,
  originStartIndex: Schema.Finite,
  originX: Schema.Finite,
  type: DragTypeSchema,
});
type DragState = typeof DragStateSchema.Type;

type BrushCommit = (next: EvilBrushRange, mode?: DragType) => void;

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
}: {
  range: EvilBrushRange;
  totalPoints: number;
  containerRef: RefObject<HTMLDivElement | null>;
  commit: BrushCommit;
}) {
  const { endIndex: rangeEndIndex, startIndex: rangeStartIndex } = range;
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
        originEndIndex: rangeEndIndex,
        originStartIndex: rangeStartIndex,
        originX: event.clientX,
        type,
      };
    },
    [rangeEndIndex, rangeStartIndex]
  );

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const delta = toIndexDelta(event.clientX - drag.originX);
      const { originEndIndex, originStartIndex, type } = drag;

      if (type === "left") {
        commit(
          {
            startIndex: originStartIndex + delta,
            endIndex: originEndIndex,
          },
          "left"
        );
        return;
      }

      if (type === "right") {
        commit(
          {
            startIndex: originStartIndex,
            endIndex: originEndIndex + delta,
          },
          "right"
        );
        return;
      }

      const span = originEndIndex - originStartIndex;
      let startIndex = originStartIndex + delta;
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

/** Creates pointer handlers for one movable part of the brush. */
type BrushBindingFactory = ReturnType<typeof useBrushDrag>["bind"];

/** Pointer handlers attached to one brush handle or the selected region. */
type BrushPointerBindings = ReturnType<BrushBindingFactory>;

export {
  type BrushBindingFactory,
  type BrushPointerBindings,
  type DragType,
  useBrushDrag,
};
