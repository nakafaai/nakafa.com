"use client";

import { useReducedMotion } from "@mantine/hooks";
import {
  BarGlowFilter,
  type BarVariant,
  DuotonePattern,
  GradientPattern,
  HatchedPattern,
  StrippedPattern,
  VerticalColorGradient,
} from "@repo/design-system/components/evilcharts/charts/composed/bars";
import { CustomBar } from "@repo/design-system/components/evilcharts/charts/composed/shape";
import {
  type ComposedAnimationType,
  DEFAULT_BAR_RADIUS,
  useComposedChart,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import { getColorsCount } from "@repo/design-system/components/evilcharts/ui/chart-config";
import { useOrderedReveal } from "@repo/design-system/components/evilcharts/ui/reveal-animation";
import { type ComponentProps, useId } from "react";
import { Bar as RechartsBar } from "recharts";

// Composible parts

interface BarProps {
  animationType?: ComposedAnimationType; // grow-in order, falls back to the chart default
  barProps?: ComponentProps<typeof RechartsBar>; // escape hatch for raw Recharts Bar props
  dataKey: string; // series key, must exist on the data and config
  enableHoverHighlight?: boolean; // dims this bar when another column is hovered
  glow?: boolean; // applies a soft neon glow to this bar
  isClickable?: boolean; // lets this bar be selected by clicking it
  radius?: number; // corner radius of the bar in pixels
  variant?: BarVariant; // fill style for this bar only
}

/**
 * A single bar series. Each <Bar /> is fully self-contained: it generates its
 * own gradient/pattern definitions under a unique id, so any number of bars,
 * each with its own variant, glow, and clickability, can live in one chart
 * without style collisions.
 */
export function Bar({
  dataKey,
  variant = "default",
  radius = DEFAULT_BAR_RADIUS,
  glow = false,
  animationType,
  isClickable = false,
  enableHoverHighlight = false,
  barProps,
}: BarProps) {
  const {
    config,
    animationType: defaultAnimation,
    dataLength,
    isLoading,
    hoveredIndex,
    selectedDataKey,
    selectDataKey,
  } = useComposedChart();
  const id = useId().replace(/:/g, ""); // unique id scopes this bar's style defs
  // Devices set to "reduce motion" skip the grow-in animation entirely
  const shouldReduceMotion = useReducedMotion();

  const isSelected = selectedDataKey === null || selectedDataKey === dataKey;
  const filter = glow ? `url(#${id}-glow)` : undefined;
  const colorSlots = getColorsCount(config[dataKey] ?? {});

  // The grow-in is a per-frame animation, heavier than a static chart, so
  // `"none"` and the OS reduce-motion preference both opt out of it.
  const revealType: ComposedAnimationType = shouldReduceMotion
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

  return (
    <>
      <RechartsBar
        dataKey={dataKey}
        fill={`url(#${id}-bar-colors)`}
        // Recharts' built-in bar animation is permanently disabled, every bar
        // instead grows in from its baseline via the staggered motion.dev shape.
        isAnimationActive={false}
        radius={radius}
        shape={
          <CustomBar
            animationType={revealType}
            barRadius={radius}
            colorSlots={colorSlots}
            dataKey={dataKey}
            dataLength={dataLength}
            enableHoverHighlight={enableHoverHighlight}
            filter={filter}
            hoveredIndex={hoveredIndex}
            id={id}
            isClickable={isClickable}
            isRevealActive={isRevealActive}
            isSelected={isSelected}
            onClick={
              isClickable
                ? () =>
                    selectDataKey(selectedDataKey === dataKey ? null : dataKey)
                : undefined
            }
            selectedDataKey={selectedDataKey}
            variant={variant}
          />
        }
        style={
          isClickable || enableHoverHighlight
            ? { cursor: "pointer" }
            : undefined
        }
        {...barProps}
      />
      <defs>
        <VerticalColorGradient config={config} dataKey={dataKey} id={id} />
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
        {glow && <BarGlowFilter id={id} />}
      </defs>
    </>
  );
}
