import { useLocalStorage } from "@mantine/hooks";
import { Number as Num, Schema } from "effect";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const UseResizableOptionsSchema = Schema.Struct({
  /**
   * The side the panel stands at: `end` for a panel at the window's right, which grows as its edge moves left, and
   * `start` for one at its left, which grows as its edge moves right.
   */
  anchor: Schema.optionalKey(Schema.Literals(["end", "start"])),
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
  anchor = "end",
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

  // A panel at the end ends where the page ends, which is the width the page lays out in. The window is wider by
  // the scrollbar a browser may take from the page, so measuring from the window would leave the edge that far
  // from the pointer. A panel at the start begins at the page's left, so the pointer is its width.
  const widthAt = (x: number) =>
    Num.clamp(
      anchor === "end" ? document.documentElement.clientWidth - x : x,
      bounds
    );

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

  /**
   * Ends a drag where the pointer last was, which is the one width it keeps, and lets the pointer go. WebKit can keep
   * a mouse captured past its release, which would send the next press elsewhere to the edge.
   */
  const handlePointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (current === null) {
      return;
    }
    window.cancelAnimationFrame(current.frame);
    drag.current = null;
    setKept(widthAt(current.x));
    setDragged(null);
  };

  // An arrow toward the page widens the panel, whichever side it stands at.
  const grow = anchor === "end" ? "ArrowLeft" : "ArrowRight";
  const shrink = anchor === "end" ? "ArrowRight" : "ArrowLeft";
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === grow) {
        e.preventDefault();
        e.stopPropagation();
        setWidth(width + STEP);
      }

      if (e.key === shrink) {
        e.preventDefault();
        e.stopPropagation();
        setWidth(width - STEP);
      }
    },
    [grow, shrink, width, setWidth]
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

/** Tells when the window changes its width. */
function subscribeToWindow(notify: () => void) {
  window.addEventListener("resize", notify);

  return () => window.removeEventListener("resize", notify);
}

/** Before the browser can measure the window, a panel has all the room it asks for. */
function readNoRoom() {
  return Number.POSITIVE_INFINITY;
}

/** The width the window leaves a panel once `keep` pixels of it stay for the page, in pixels. */
export function useWindowRoom(keep: number) {
  return useSyncExternalStore(
    subscribeToWindow,
    () => window.innerWidth - keep,
    readNoRoom
  );
}
