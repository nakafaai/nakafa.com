"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

/**
 * Renders the COSS slider track, range, and thumbs on top of Base UI behavior.
 *
 * Base UI keeps pointer, keyboard, form, and multi-thumb behavior in the
 * primitive. The wrapper only owns Nakafa's visual treatment and cursor affordance.
 *
 * @see https://base-ui.com/react/components/slider
 */
function Slider<Value extends number | readonly number[]>({
  "aria-label": ariaLabel,
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props<Value>) {
  let thumbCount = 1;

  if (Array.isArray(defaultValue)) {
    thumbCount = defaultValue.length;
  }

  if (Array.isArray(value)) {
    thumbCount = value.length;
  }

  const thumbKeys = createThumbKeys(thumbCount);

  return (
    <SliderPrimitive.Root
      className={cn("data-vertical:h-full data-horizontal:w-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      thumbAlignment="edge"
      value={value}
      {...props}
    >
      <SliderPrimitive.Control
        className={cn(
          "relative flex w-full cursor-pointer touch-none select-none items-center data-vertical:h-full data-vertical:min-h-44 data-vertical:w-auto data-disabled:cursor-not-allowed data-vertical:flex-col data-disabled:opacity-50"
        )}
      >
        <SliderPrimitive.Track
          className={cn(
            "relative grow cursor-pointer select-none overflow-hidden rounded-full bg-muted data-horizontal:h-1.5 data-vertical:h-full data-horizontal:w-full data-vertical:w-1.5 data-disabled:cursor-not-allowed"
          )}
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className={cn(
              "select-none bg-primary data-horizontal:h-full data-vertical:w-full"
            )}
            data-slot="slider-range"
          />
        </SliderPrimitive.Track>
        {thumbKeys.map((thumbKey, thumbIndex) => (
          <SliderPrimitive.Thumb
            aria-label={ariaLabel}
            className="block size-4 shrink-0 cursor-grab select-none rounded-full border border-primary bg-background shadow-sm ring-ring/50 transition-[color,box-shadow] hover:ring-4 focus-visible:outline-hidden focus-visible:ring-4 data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-dragging:cursor-grabbing data-disabled:opacity-50"
            data-slot="slider-thumb"
            index={thumbIndex}
            key={thumbKey}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

/**
 * Displays the current slider value using Base UI's formatted output contract.
 *
 * Keep this as a primitive companion so callers can show live values without
 * reimplementing range formatting or subscribing to controlled state manually.
 */
function SliderValue({
  className,
  ...props
}: ComponentProps<typeof SliderPrimitive.Value>) {
  return (
    <SliderPrimitive.Value
      className={cn("text-muted-foreground text-sm tabular-nums", className)}
      data-slot="slider-value"
      {...props}
    />
  );
}

/**
 * Creates stable thumb keys by slot so controlled value updates do not remount
 * the active thumb during pointer interaction.
 */
function createThumbKeys(thumbCount: number) {
  return Array.from(
    { length: thumbCount },
    (_, thumbSlot) => `thumb-slot-${thumbSlot}`
  );
}

export { Slider, SliderValue };
