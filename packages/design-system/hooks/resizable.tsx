import { useLocalStorage } from "@mantine/hooks";
import { Number as Num, Schema } from "effect";
import { useCallback, useEffect, useRef, useState } from "react";

const UseResizableOptionsSchema = Schema.Struct({
  initialWidth: Schema.Finite,
  maxWidth: Schema.Finite,
  minWidth: Schema.Finite,
  /** The name the width stays under in this browser, so a width a person sets holds across a reload. */
  storageKey: Schema.String,
});

type UseResizableOptions = typeof UseResizableOptionsSchema.Type;

/** How far one press of an arrow key moves the edge, in pixels. */
const STEP = 10;

/**
 * The attribute the root carries while an edge is dragged. The styles read it to keep the page's work to what
 * the reader sees for the drag's length, and to hold the resize cursor wherever the pointer goes (`globals.css`).
 */
const RESIZING_ATTRIBUTE = "data-resizing";

/**
 * Manages the drag and keyboard resizing of a panel's edge.
 *
 * `width` is the width the panel has: the width the reader asked for, held between `minWidth` and `maxWidth`.
 * `maxWidth` may change while the panel is open, with the room a window leaves for it, and the width follows:
 * it shrinks with the room and comes back with it. A key moves the edge from the width the panel has, so no
 * press is lost beyond a bound the reader cannot see. The values of the resizer say that width and those bounds.
 * The panel starts closed, so the kept width is read after the first render and nothing that shows moves.
 *
 * A drag follows the pointer, a mouse, a pen or a finger, through pointer capture, so it holds wherever the
 * pointer goes. However many moves a frame brings, the width changes once in it, and the browser's storage is
 * written once, when the pointer lets go: a drag never waits on storage or lays the page out twice in a frame.
 */
export function useResizable({
  initialWidth,
  minWidth,
  maxWidth,
  storageKey,
}: UseResizableOptions) {
  const [kept, setKept] = useLocalStorage({
    defaultValue: initialWidth,
    key: storageKey,
  });
  // The width a drag asks for, which reaches storage only when the pointer lets go.
  const [dragged, setDragged] = useState<number | null>(null);
  // The drag's latest pointer and the frame that will apply it, which a move never renders by itself.
  const drag = useRef<{ frame: number; x: number } | null>(null);
  const bounds = { maximum: maxWidth, minimum: minWidth };
  const width = Num.clamp(dragged ?? kept, bounds);
  const isResizing = dragged !== null;

  /** Asks for a width, which the panel has once it is within the bounds. */
  const setWidth = useCallback(
    (next: number) =>
      setKept(Num.clamp(next, { maximum: maxWidth, minimum: minWidth })),
    [minWidth, maxWidth, setKept]
  );

  // The panel ends where the page ends, which is the width the page lays out in. The window is wider by the
  // scrollbar a browser may take from the page, so measuring from the window would leave the edge that far
  // from the pointer.
  const widthAt = (x: number) =>
    Num.clamp(document.documentElement.clientWidth - x, bounds);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { frame: 0, x: event.clientX };
    setDragged(width);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (current === null) {
      return;
    }
    current.x = event.clientX;
    if (current.frame !== 0) {
      return;
    }
    current.frame = window.requestAnimationFrame(() => {
      current.frame = 0;
      setDragged(widthAt(current.x));
    });
  };

  /** Ends a drag where the pointer last was, which is the one width it keeps. */
  const handlePointerEnd = () => {
    const current = drag.current;
    if (current === null) {
      return;
    }
    window.cancelAnimationFrame(current.frame);
    drag.current = null;
    setKept(widthAt(current.x));
    setDragged(null);
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        setWidth(width + STEP);
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        setWidth(width - STEP);
      }
    },
    [width, setWidth]
  );

  useEffect(() => {
    if (!isResizing) {
      return;
    }
    const root = document.documentElement;
    root.setAttribute(RESIZING_ATTRIBUTE, "");
    return () => root.removeAttribute(RESIZING_ATTRIBUTE);
  }, [isResizing]);

  return {
    width,
    isResizing,
    resizerProps: {
      onKeyDown: handleKeyDown,
      onLostPointerCapture: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      "aria-valuenow": width,
      "aria-valuemin": minWidth,
      "aria-valuemax": maxWidth,
      "aria-orientation": "vertical" as const,
    },
    setWidth,
  };
}
