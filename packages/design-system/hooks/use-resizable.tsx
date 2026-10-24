import { Number as Num, Schema } from "effect";
import { useCallback, useEffect, useEffectEvent, useState } from "react";

const UseResizableOptionsSchema = Schema.Struct({
  initialWidth: Schema.Finite,
  maxWidth: Schema.Finite,
  minWidth: Schema.Finite,
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
 * values of the resizer say that width and those bounds.
 */
export function useResizable({
  initialWidth,
  minWidth,
  maxWidth,
}: UseResizableOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const [asked, setAsked] = useState(initialWidth);
  const width = Num.clamp(asked, { maximum: maxWidth, minimum: minWidth });

  /** Asks for a width, which the panel has once it is within the bounds. */
  const setWidth = useCallback(
    (next: number) =>
      setAsked(Num.clamp(next, { maximum: maxWidth, minimum: minWidth })),
    [minWidth, maxWidth]
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
    setWidth(document.documentElement.clientWidth - e.clientX);
  });

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
