import { useLocalStorage } from "@mantine/hooks";
import { Number as Num, Schema } from "effect";
import {
  useCallback,
  useEffect,
  useEffectEvent,
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
 * Manages horizontal drag and keyboard resizing state for resizable panels.
 *
 * `width` is the width the panel has: the width the reader asked for, held
 * between `minWidth` and `maxWidth`. `maxWidth` may change while the panel is
 * open, with the room a window leaves for it, and the width follows: it shrinks
 * with the room and comes back with it. A key moves the edge from the width the
 * panel has, so no press is lost beyond a bound the reader cannot see. The
 * values of the resizer say that width and those bounds. The panel starts closed, so
 * the kept width is read after the first render and nothing that shows moves.
 */
export function useResizable({
  anchor = "end",
  initialWidth,
  minWidth,
  maxWidth,
  storageKey,
}: UseResizableOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const [asked, setAsked] = useLocalStorage({
    defaultValue: initialWidth,
    key: storageKey,
  });
  const width = Num.clamp(asked, { maximum: maxWidth, minimum: minWidth });

  /** Asks for a width, which the panel has once it is within the bounds. */
  const setWidth = useCallback(
    (next: number) =>
      setAsked(Num.clamp(next, { maximum: maxWidth, minimum: minWidth })),
    [minWidth, maxWidth, setAsked]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  const handleMouseUp = useEffectEvent(() => {
    setIsResizing(false);
  });

  // The panel ends where the page ends, which is the width the page lays out
  // in. The window is wider by the scrollbar a browser may take from the page,
  // so measuring from the window would leave the edge that far from the pointer.
  const handleMouseMove = useEffectEvent((e: MouseEvent) => {
    setWidth(
      anchor === "end"
        ? document.documentElement.clientWidth - e.clientX
        : e.clientX
    );
  });

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

    const onMouseMove = (event: MouseEvent) => handleMouseMove(event);
    const onMouseUp = () => handleMouseUp();

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isResizing]);

  return {
    width,
    isResizing,
    resizerProps: {
      onMouseDown: handleMouseDown,
      onKeyDown: handleKeyDown,
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
