"use client";

import { useCallback, useEffect, useState } from "react";

type UseResizableOptions = {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  onResize?: (width: number) => void;
};

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

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      let newWidth = window.innerWidth - e.clientX;

      if (newWidth < minWidth) {
        newWidth = minWidth;
      }

      if (newWidth > maxWidth) {
        newWidth = maxWidth;
      }

      setWidth(newWidth);
    },
    [minWidth, maxWidth],
  );

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
    [minWidth, maxWidth],
  );

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

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
