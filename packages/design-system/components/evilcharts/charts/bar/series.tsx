"use client";

import { useReducedMotion } from "@mantine/hooks";
import {
  type BarVariant,
  BufferHatchedPattern,
  ColorGradient,
  DuotonePattern,
  GlowFilter,
  GradientPattern,
  HatchedPattern,
  StrippedPattern,
} from "@repo/design-system/components/evilcharts/charts/bar/paint";
import { CustomBar } from "@repo/design-system/components/evilcharts/charts/bar/shape";
import {
  type BarAnimationType,
  useBarChart,
} from "@repo/design-system/components/evilcharts/charts/bar-chart";
import {
  getChartSeriesId,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { useOrderedReveal } from "@repo/design-system/components/evilcharts/ui/reveal-animation";
import { type ComponentProps, useId } from "react";
import { Bar as RechartsBar } from "recharts";

const STACK_ID = "evil-stacked";

// Composible parts

interface BarProps {
  animationType?: BarAnimationType; // grow-in order, falls back to the chart default
  barProps?: ComponentProps<typeof RechartsBar>; // escape hatch for raw Recharts Bar props
  bufferBar?: boolean; // renders the last data point as a hatched "buffer" bar
  dataKey: string; // series key, must exist on the data and config
  enableHoverHighlight?: boolean; // dims this bar while another bar is hovered
  glowing?: boolean; // applies a soft outer glow to this bar
  isClickable?: boolean; // lets this bar be selected by clicking it
  radius?: number; // corner radius, falls back to the chart default
  variant?: BarVariant; // fill style for this bar only
}

/**
 * A single bar series. Each <Bar /> is fully self-contained: it generates its
 * own gradient/pattern definitions under a unique id, so any number of bars,
 * each with its own variant, radius, glow, and clickability, can live in one
 * chart without style collisions.
 */
export function Bar({
  dataKey,
  variant = "default",
  radius,
  animationType,
  isClickable = false,
  enableHoverHighlight = false,
  glowing = false,
  bufferBar = false,
  barProps,
}: BarProps) {
  const {
    config,
    isStacked,
    isHorizontal,
    isLoading,
    barRadius: defaultRadius,
    animationType: defaultAnimation,
    dataLength,
    selectedDataKey,
    selectDataKey,
    isMouseInChart,
  } = useBarChart();
  const id = useId().replace(/:/g, ""); // unique id scopes this bar's style defs
  // Devices set to "reduce motion" skip the grow-in animation entirely
  const shouldReduceMotion = useReducedMotion();

  const resolvedRadius = radius ?? defaultRadius;
  const isSelected = selectedDataKey === dataKey;
  const colorSlots = getColorsCount(config[dataKey] ?? {});

  // The grow-in is a per-frame animation, heavier than a static chart, so
  // `"none"` and the OS reduce-motion preference both opt out of it.
  const revealType: BarAnimationType = shouldReduceMotion
    ? "none"
    : (animationType ?? defaultAnimation);
  const isRevealActive = useOrderedReveal(
    isLoading ? "none" : revealType,
    dataLength
  );

  // The root renders the skeleton bar while loading, so real bars step aside
  if (isLoading) {
    return null;
  }

  const customBarProps = {
    id,
    dataKey,
    variant,
    barRadius: resolvedRadius,
    glowing,
    bufferBar,
    isClickable,
    enableHoverHighlight,
    isMouseInChart,
    isHorizontal,
    isRevealActive,
    selectedDataKey,
    dataLength,
    colorSlots,
    onClick: isClickable
      ? () => {
          // Clicking the selected bar clears the selection, otherwise selects it
          selectDataKey(isSelected ? null : dataKey);
        }
      : undefined,
  };

  return (
    <>
      <RechartsBar
        activeBar={<CustomBar {...customBarProps} animationType="none" />}
        dataKey={dataKey}
        fill={`url(#${getChartSeriesId(id, "colors", dataKey)})`}
        // Recharts' built-in bar animation is permanently disabled, every bar
        // instead grows in from its baseline via the staggered motion.dev shape.
        isAnimationActive={false}
        radius={resolvedRadius}
        shape={<CustomBar {...customBarProps} animationType={revealType} />}
        stackId={isStacked ? STACK_ID : undefined}
        style={
          isClickable || enableHoverHighlight
            ? { cursor: "pointer" }
            : undefined
        }
        {...barProps}
      />
      <defs>
        <ColorGradient config={config} dataKey={dataKey} id={id} />
        {variant === "hatched" && <HatchedPattern dataKey={dataKey} id={id} />}
        {(variant === "duotone" || variant === "duotone-reverse") && (
          <DuotonePattern
            config={config}
            dataKey={dataKey}
            id={id}
            variant={variant}
          />
        )}
        {variant === "gradient" && (
          <GradientPattern dataKey={dataKey} id={id} />
        )}
        {variant === "stripped" && (
          <StrippedPattern dataKey={dataKey} id={id} />
        )}
        {bufferBar && <BufferHatchedPattern dataKey={dataKey} id={id} />}
        {glowing && <GlowFilter dataKey={dataKey} id={id} />}
      </defs>
    </>
  );
}
