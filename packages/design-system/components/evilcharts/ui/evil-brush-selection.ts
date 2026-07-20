import type { EvilBrushRange } from "@repo/design-system/components/evilcharts/ui/evil-brush";
import {
  type DragType,
  useBrushDrag,
} from "@repo/design-system/components/evilcharts/ui/evil-brush-drag";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseBrushSelectionOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  controlledEnd?: number;
  controlledStart?: number;
  defaultEndIndex?: number;
  defaultStartIndex: number;
  minSpan: number;
  onChange?: (range: EvilBrushRange) => void;
  totalPoints: number;
}

function rangesEqual(current: EvilBrushRange, next: EvilBrushRange) {
  return (
    current.startIndex === next.startIndex && current.endIndex === next.endIndex
  );
}

function clampRange(
  range: EvilBrushRange,
  totalPoints: number,
  minSpan: number,
  mode?: DragType
): EvilBrushRange {
  const maxIndex = Math.max(0, totalPoints - 1);
  let startIndex = Math.max(0, Math.min(range.startIndex, maxIndex));
  let endIndex = Math.max(0, Math.min(range.endIndex, maxIndex));

  if (mode === "left") {
    const maxStart = Math.max(0, endIndex - minSpan);
    startIndex = Math.min(startIndex, maxStart);
    return { startIndex, endIndex };
  }

  if (mode === "right") {
    const minEnd = Math.min(maxIndex, startIndex + minSpan);
    endIndex = Math.max(endIndex, minEnd);
    return { startIndex, endIndex };
  }

  if (endIndex - startIndex >= minSpan) {
    return { startIndex, endIndex };
  }

  endIndex = Math.min(startIndex + minSpan, maxIndex);
  if (endIndex - startIndex < minSpan) {
    startIndex = Math.max(0, endIndex - minSpan);
  }

  return { startIndex, endIndex };
}

/**
 * Owns the controlled or uncontrolled brush selection. Updates are clamped and
 * deduplicated before they reach the parent chart.
 */
function useBrushSelection({
  containerRef,
  controlledEnd,
  controlledStart,
  defaultEndIndex,
  defaultStartIndex,
  minSpan,
  onChange,
  totalPoints,
}: UseBrushSelectionOptions) {
  const isControlled =
    controlledStart !== undefined && controlledEnd !== undefined;
  const [internalRange, setInternalRange] = useState<EvilBrushRange>(() =>
    clampRange(
      {
        startIndex: defaultStartIndex,
        endIndex: defaultEndIndex ?? totalPoints - 1,
      },
      totalPoints,
      minSpan
    )
  );
  const range = clampRange(
    isControlled
      ? { startIndex: controlledStart, endIndex: controlledEnd }
      : internalRange,
    totalPoints,
    minSpan
  );
  const rangeStartIndex = range.startIndex;
  const rangeEndIndex = range.endIndex;
  const lastCommittedRef = useRef(range);

  useEffect(() => {
    lastCommittedRef.current = {
      startIndex: rangeStartIndex,
      endIndex: rangeEndIndex,
    };
  }, [rangeStartIndex, rangeEndIndex]);

  const commit = useCallback(
    (next: EvilBrushRange, mode?: DragType) => {
      const clamped = clampRange(next, totalPoints, minSpan, mode);
      if (rangesEqual(lastCommittedRef.current, clamped)) {
        return;
      }

      lastCommittedRef.current = clamped;
      if (!isControlled) {
        setInternalRange(clamped);
      }

      onChange?.(clamped);
    },
    [isControlled, minSpan, onChange, totalPoints]
  );
  const { bind } = useBrushDrag({
    commit,
    containerRef,
    range,
    totalPoints,
  });

  return { bind, range };
}

export { useBrushSelection };
