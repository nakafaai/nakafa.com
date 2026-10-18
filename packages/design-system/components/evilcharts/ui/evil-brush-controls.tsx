import { useChart } from "@repo/design-system/components/evilcharts/ui/chart";
import type { BrushBindingFactory } from "@repo/design-system/components/evilcharts/ui/evil-brush-drag";
import { EvilBrushHandle } from "@repo/design-system/components/evilcharts/ui/evil-brush-handle";

interface EvilBrushControlsProps {
  bind: BrushBindingFactory;
  data: Record<string, unknown>[];
  rangeEndIndex: number;
  rangeStartIndex: number;
  totalPoints: number;
}

function getBrushLabel(
  data: Record<string, unknown>[],
  index: number,
  xDataKey?: string,
  formatLabel?: (value: unknown, index: number) => string
) {
  if (!xDataKey) {
    return String(index);
  }

  const value = data[index]?.[xDataKey];
  if (formatLabel) {
    return formatLabel(value, index);
  }

  return String(value ?? index);
}

/** Renders the spring-animated selection region and its draggable edges. */
function EvilBrushControls({
  bind,
  data,
  rangeEndIndex,
  rangeStartIndex,
  totalPoints,
}: EvilBrushControlsProps) {
  const { formatLabel, xDataKey } = useChart((chart) => chart.brush);
  const leftPercent =
    totalPoints > 1 ? (rangeStartIndex / (totalPoints - 1)) * 100 : 0;
  const rightPercent =
    totalPoints > 1 ? (rangeEndIndex / (totalPoints - 1)) * 100 : 100;
  const leftPosition = `${leftPercent}%`;
  const rightPosition = `${rightPercent}%`;
  const rightOverlayWidth = `${Math.max(0, 100 - rightPercent)}%`;
  const selectedWidth = `${Math.max(0, rightPercent - leftPercent)}%`;

  const leftLabel = getBrushLabel(data, rangeStartIndex, xDataKey, formatLabel);
  const rightLabel = getBrushLabel(data, rangeEndIndex, xDataKey, formatLabel);

  return (
    <>
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-l-md bg-background/70 backdrop-blur-[2px]"
        style={{ width: leftPosition }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 rounded-r-md bg-background/70 backdrop-blur-[2px]"
        style={{ width: rightOverlayWidth }}
      />
      <div
        className="absolute inset-y-0 cursor-grab touch-none rounded-sm border active:cursor-grabbing"
        style={{ left: leftPosition, width: selectedWidth }}
        {...bind("middle")}
      />
      <EvilBrushHandle
        bind={bind("left")}
        label={leftLabel}
        position={leftPosition}
        side="left"
      />
      <EvilBrushHandle
        bind={bind("right")}
        label={rightLabel}
        position={rightPosition}
        side="right"
      />
    </>
  );
}

export { EvilBrushControls };
