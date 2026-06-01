"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

interface UseResizableOptions {
  initialWidth: number;
  maxWidth: number;
  minWidth: number;
  onResize?: (width: number) => void;
}

/**
 * Manages horizontal drag and keyboard resizing state for resizable panels.
 */
export function useResizable({
  initialWidth,
  minWidth,
  maxWidth,
}: UseResizableOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const [width, setWidth] = useState(initialWidth);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  const handleMouseUp = useEffectEvent(() => {
    setIsResizing(false);
  });

  const handleMouseMove = useEffectEvent((e: MouseEvent) => {
    let newWidth = window.innerWidth - e.clientX;

    if (newWidth < minWidth) {
      newWidth = minWidth;
    }

    if (newWidth > maxWidth) {
      newWidth = maxWidth;
    }

    setWidth(newWidth);
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        setWidth((prev) => {
          const newWidth = prev + 10;
          return newWidth > maxWidth ? maxWidth : newWidth;
        });
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        setWidth((prev) => {
          const newWidth = prev - 10;
          return newWidth < minWidth ? minWidth : newWidth;
        });
      }
    },
    [minWidth, maxWidth]
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
