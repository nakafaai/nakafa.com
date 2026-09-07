"use client";

import type { BarVariant } from "@repo/design-system/components/evilcharts/charts/bar/paint";
import type { BarAnimationType } from "@repo/design-system/components/evilcharts/charts/bar-chart";
import {
  getChartColorVariable,
  getChartSeriesId,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  REVEAL_EASE,
  RevealGroup,
} from "@repo/design-system/components/evilcharts/ui/reveal";
import {
  BAR_REVEAL_DURATION_MS,
  BAR_REVEAL_STAGGER_MS,
  getOrderedRevealStep,
} from "@repo/design-system/components/evilcharts/ui/reveal-animation";
import type { KeyboardEvent } from "react";
import { Rectangle } from "recharts";
import type { RectRadius } from "recharts/types/shape/Rectangle";

// Custom bar shape

// Raw geometry Recharts hands to a custom bar shape
export interface BarShapeProps {
  dataKey?: string;
  fill?: string;
  fillOpacity?: number;
  height?: number;
  index?: number;
  width?: number;
  x?: number;
  y?: number;
  [key: string]: unknown;
}

// Per-series config the <Bar /> threads into every CustomBar render
type CustomBarProps = {
  id: string;
  dataKey: string;
  variant: BarVariant;
  barRadius: number;
  glowing?: boolean;
  bufferBar?: boolean;
  isClickable?: boolean;
  enableHoverHighlight?: boolean;
  isMouseInChart?: boolean;
  isHorizontal?: boolean;
  isRevealActive?: boolean;
  animationType?: BarAnimationType;
  selectedDataKey?: string | null;
  isActive?: boolean;
  dataLength?: number;
  colorSlots: number;
  onClick?: () => void;
} & BarShapeProps;

/**
 * Custom bar shape. Renders the visible bar painted by the owning <Bar />'s
 * variant pattern, with an invisible full-height rectangle behind it to keep
 * the whole column hoverable and clickable.
 */
export const CustomBar = (props: CustomBarProps) => {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    id,
    dataKey,
    variant,
    barRadius,
    glowing,
    bufferBar,
    isClickable,
    enableHoverHighlight,
    isMouseInChart,
    isHorizontal = false,
    isRevealActive = false,
    animationType = "none",
    selectedDataKey,
    isActive,
    dataLength = 0,
    colorSlots,
    onClick,
  } = props;

  const index = typeof props.index === "number" ? props.index : -1;
  const isLastBar = bufferBar && dataLength > 0 && index === dataLength - 1;
  const isStripped = variant === "stripped";
  const grow = getBarGrowAnimation(
    animationType,
    index,
    dataLength,
    isHorizontal,
    isRevealActive
  );

  const fill = isLastBar
    ? `url(#${getChartSeriesId(id, "buffer-hatched", dataKey)})`
    : getVariantFill(variant, id, dataKey, index, colorSlots);
  const filter = glowing
    ? `url(#${getChartSeriesId(id, "bar-glow", dataKey)})`
    : undefined;

  const fillOpacity = getBarOpacity({
    isClickable,
    selectedDataKey,
    dataKey,
    enableHoverHighlight,
    isMouseInChart,
    isActive,
  });
  const cursorStyle =
    isClickable || enableHoverHighlight ? { cursor: "pointer" } : undefined;

  // Stripped bars round only their top corners; every other variant rounds all four
  const radius: RectRadius = isStripped
    ? [barRadius, barRadius, 0, 0]
    : barRadius;

  const interactiveProps = onClick
    ? {
        onClick,
        onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          onClick();
        },
        role: "button",
        tabIndex: 0,
      }
    : {};

  return (
    <g {...interactiveProps} style={cursorStyle}>
      {/* Full-height invisible rect keeps the whole column hoverable/clickable */}
      <Rectangle {...props} fill="transparent" />
      {/* The painted bar grows in from its baseline; the hit rect above stays put */}
      <RevealGroup animation={grow}>
        <Rectangle
          fill={fill}
          filter={filter}
          height={Math.max(0, height - 3)}
          opacity={fillOpacity}
          radius={radius}
          stroke={
            isLastBar
              ? `url(#${getChartSeriesId(id, "colors", dataKey)})`
              : undefined
          }
          strokeWidth={isLastBar ? 1 : undefined}
          width={width}
          x={x}
          y={y}
        />
        {isStripped && (
          <Rectangle
            fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
            height={2}
            radius={1}
            width={width}
            x={x}
            y={y - 4}
          />
        )}
      </RevealGroup>
    </g>
  );
};

/**
 * Builds the motion.dev grow-in animation for a single bar, or returns `null`
 * when the bar should render statically (`"none"`, reduced motion, an unknown
 * index, empty data, or once the intro window is complete).
 *
 * Every bar grows from its baseline, `scaleY` from the bottom for vertical
 * layout, `scaleX` from the left for horizontal, and `animationType` decides
 * the stagger order, so the chart fills in one bar at a time.
 *
 * The owning <Bar /> series owns its reveal window. Once the window ends, every
 * bar renders as plain SVG geometry, so long/offscreen content cannot leave
 * bars hidden behind stale animation transforms.
 */
const getBarGrowAnimation = (
  animationType: BarAnimationType,
  index: number,
  dataLength: number,
  isHorizontal: boolean,
  isRevealActive: boolean
) => {
  if (
    animationType === "none" ||
    index < 0 ||
    dataLength <= 0 ||
    !isRevealActive
  ) {
    return null;
  }

  const step = getOrderedRevealStep(animationType, index, dataLength);
  const transition = {
    duration: BAR_REVEAL_DURATION_MS / 1000,
    ease: REVEAL_EASE,
    delay: (step * BAR_REVEAL_STAGGER_MS) / 1000,
  };

  // Horizontal bars grow rightward from the left edge, vertical from the bottom
  return isHorizontal
    ? {
        animate: { scaleX: [0, 1] },
        transition,
        style: { originX: 0 },
      }
    : {
        animate: { scaleY: [0, 1] },
        transition,
        style: { originY: 1 },
      };
};

// Selection + fill helpers

// Resolves the SVG paint reference for a bar's fill based on its variant
const getVariantFill = (
  variant: BarVariant,
  id: string,
  dataKey: string,
  index: number,
  colorSlots: number
): string => {
  switch (variant) {
    case "hatched":
      return `url(#${getChartSeriesId(id, "hatched", dataKey)})`;
    case "duotone":
      return `url(#${getChartSeriesId(id, "duotone", dataKey)})`;
    case "duotone-reverse":
      return `url(#${getChartSeriesId(id, "duotone-reverse", dataKey)})`;
    case "gradient":
      return `url(#${getChartSeriesId(id, "gradient", dataKey)})`;
    case "stripped":
      return `url(#${getChartSeriesId(id, "stripped", dataKey)})`;
    default:
      if (colorSlots > 1 && index >= 0) {
        return getChartColorVariable(dataKey, index, colorSlots - 1);
      }

      return `url(#${getChartSeriesId(id, "colors", dataKey)})`;
  }
};

// Computes bar opacity from the click selection and hover-highlight state
const getBarOpacity = ({
  isClickable,
  selectedDataKey,
  dataKey,
  enableHoverHighlight,
  isMouseInChart,
  isActive,
}: {
  isClickable?: boolean;
  selectedDataKey?: string | null;
  dataKey: string;
  enableHoverHighlight?: boolean;
  isMouseInChart?: boolean;
  isActive?: boolean;
}) => {
  const isSelectedDataKey =
    selectedDataKey === null || selectedDataKey === dataKey;
  let clickOpacity = 1;
  if (isClickable && selectedDataKey !== null) {
    clickOpacity = isSelectedDataKey ? 1 : 0.3;
  }

  // While hovering, the hovered bar keeps its click opacity and the rest dim further
  if (enableHoverHighlight && isMouseInChart) {
    return isActive ? clickOpacity : clickOpacity * 0.3;
  }

  return clickOpacity;
};
