"use client";

import type { BarVariant } from "@repo/design-system/components/evilcharts/charts/composed/bars";
import type { ComposedAnimationType } from "@repo/design-system/components/evilcharts/charts/composed-chart";
import { getChartColorVariable } from "@repo/design-system/components/evilcharts/ui/chart-config";
import { REVEAL_EASE } from "@repo/design-system/components/evilcharts/ui/reveal";
import {
  BAR_REVEAL_DURATION_MS,
  BAR_REVEAL_STAGGER_MS,
  getOrderedRevealStep,
} from "@repo/design-system/components/evilcharts/ui/reveal-animation";
import { m } from "motion/react";
import type { KeyboardEvent } from "react";

// Custom bar shape

// Props Recharts passes to a bar's custom shape renderer
interface BarShapeProps {
  background?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
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

type CustomBarProps = {
  hoveredIndex: number | null;
  isSelected: boolean;
  selectedDataKey: string | null;
  id: string; // unique id of the owning <Bar />
  dataKey: string; // series key used for config-driven colors
  variant: BarVariant; // fill style of the bar
  barRadius: number; // corner radius of the bar
  colorSlots: number; // number of theme colors declared for this series
  filter?: string; // optional glow filter reference
  isClickable: boolean; // whether the bar is selectable by click
  enableHoverHighlight: boolean; // whether hovering a column dims the others
  animationType?: ComposedAnimationType; // grow-in order for this bar
  dataLength?: number; // total bars in the series, drives the stagger
  isRevealActive?: boolean; // whether the owning bar series is in its intro window
  onClick?: () => void; // fired when a clickable bar is clicked
} & BarShapeProps;

// Renders a single bar rectangle with its variant fill, glow, and hit area
export const CustomBar = ({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  background,
  index = -1,
  id,
  hoveredIndex,
  isSelected,
  selectedDataKey,
  dataKey,
  variant,
  barRadius,
  colorSlots,
  filter,
  isClickable,
  enableHoverHighlight,
  animationType = "none",
  dataLength = 0,
  isRevealActive = false,
  onClick,
}: CustomBarProps) => {
  const fillOpacity = getBarOpacity({
    isClickable,
    isSelected,
    selectedDataKey,
    enableHoverHighlight,
    hoveredIndex,
    index,
  });
  const cursorStyle =
    isClickable || enableHoverHighlight ? { cursor: "pointer" } : undefined;
  const hitAreaX = background?.x ?? x;
  const hitAreaY = background?.y ?? y;
  const hitAreaWidth = background?.width ?? width;
  const hitAreaHeight = background?.height ?? height;

  const grow = getBarGrowAnimation(
    animationType,
    index,
    dataLength,
    isRevealActive
  );

  const getFill = () => {
    switch (variant) {
      case "hatched":
        return `url(#${id}-hatched)`;
      case "duotone":
        return `url(#${id}-duotone)`;
      case "duotone-reverse":
        return `url(#${id}-duotone-reverse)`;
      case "gradient":
        return `url(#${id}-gradient)`;
      case "stripped":
        return `url(#${id}-stripped)`;
      default:
        if (colorSlots > 1 && index >= 0) {
          return getChartColorVariable(dataKey, index, colorSlots - 1);
        }

        return `url(#${id}-bar-colors)`;
    }
  };

  // Full-height invisible rect, keeps the column hoverable even mid grow-in
  const hitArea = enableHoverHighlight ? (
    <rect
      fill="transparent"
      height={hitAreaHeight}
      width={hitAreaWidth}
      x={hitAreaX}
      y={hitAreaY}
    />
  ) : null;
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

  if (variant === "stripped") {
    const strippedBar = (
      <>
        <rect fill={getFill()} height={height} width={width} x={x} y={y} />
        <rect
          fill={`url(#${id}-bar-colors)`}
          height={2}
          width={width}
          x={x}
          y={y}
        />
      </>
    );

    return (
      <g {...interactiveProps} style={cursorStyle}>
        {grow ? (
          <m.g
            animate={grow.animate}
            className="transition-opacity duration-200"
            filter={filter}
            opacity={fillOpacity}
            style={grow.style}
            transition={grow.transition}
          >
            {strippedBar}
          </m.g>
        ) : (
          <g
            className="transition-opacity duration-200"
            filter={filter}
            opacity={fillOpacity}
          >
            {strippedBar}
          </g>
        )}
        {hitArea}
      </g>
    );
  }

  const bar = (
    <rect
      className="transition-opacity duration-200"
      fill={getFill()}
      filter={filter}
      height={height}
      opacity={fillOpacity}
      rx={barRadius}
      ry={barRadius}
      width={width}
      x={x}
      y={y}
    />
  );

  return (
    <g {...interactiveProps} style={cursorStyle}>
      {grow ? (
        <m.g
          animate={grow.animate}
          style={grow.style}
          transition={grow.transition}
        >
          {bar}
        </m.g>
      ) : (
        bar
      )}
      {hitArea}
    </g>
  );
};

/**
 * Builds the motion.dev grow-in animation for a single bar, or returns `null`
 * when it should render statically (`"none"`, an unknown index, empty data, or
 * once the intro window is complete).
 *
 * The owning <Bar /> series owns its reveal window. Once the window ends, every
 * bar renders as plain SVG geometry, so long/offscreen content cannot leave
 * bars hidden behind stale animation transforms.
 */
const getBarGrowAnimation = (
  animationType: ComposedAnimationType,
  index: number,
  dataLength: number,
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

  return {
    animate: { scaleY: [0, 1] },
    transition: {
      duration: BAR_REVEAL_DURATION_MS / 1000,
      ease: REVEAL_EASE,
      delay: (step * BAR_REVEAL_STAGGER_MS) / 1000,
    },
    style: { originY: 1 }, // grow upward from the baseline
  };
};

// Returns the fill opacity for a bar, accounting for both selection and hover state
const getBarOpacity = ({
  isClickable,
  isSelected,
  selectedDataKey,
  enableHoverHighlight,
  hoveredIndex,
  index,
}: {
  isClickable: boolean;
  isSelected: boolean;
  selectedDataKey: string | null;
  enableHoverHighlight: boolean;
  hoveredIndex: number | null;
  index: number;
}) => {
  let clickOpacity = 1;
  if (isClickable && selectedDataKey !== null) {
    clickOpacity = isSelected ? 1 : 0.3;
  }

  if (enableHoverHighlight && hoveredIndex !== null) {
    return hoveredIndex === index ? clickOpacity : clickOpacity * 0.3;
  }

  return clickOpacity;
};
