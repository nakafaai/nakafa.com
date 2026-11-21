import {
  SliderControl,
  SliderIndicator,
  Slider as SliderPrimitive,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider";
import { cn } from "cn";
import { Array as Arr } from "effect";
import type * as React from "react";

/**
 * A number, or a range of two, set by dragging its thumbs or with the arrow keys. The track stands in by half a
 * thumb on each side, so a thumb at either end stays inside the slider's box.
 */
function Slider<Value extends number | number[]>({
  "aria-label": ariaLabel,
  className,
  ...props
}: React.ComponentProps<typeof SliderPrimitive<Value>>) {
  const current = props.value ?? props.defaultValue;
  const thumbs = Arr.isArray(current) ? current.length : 1;

  return (
    <SliderPrimitive
      className={cn(
        "w-full data-vertical:h-full data-vertical:w-auto",
        className
      )}
      {...props}
    >
      <SliderControl className="relative flex w-full cursor-pointer items-center py-1.5 select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-44 data-vertical:w-auto data-vertical:flex-col data-vertical:px-1.5 data-vertical:py-0">
        <SliderTrack className="border-input bg-background mx-2 grow rounded-full border data-horizontal:h-1.5 data-vertical:mx-0 data-vertical:my-2 data-vertical:w-1.5">
          <SliderIndicator className="bg-primary rounded-full" />
          {Arr.map(thumbKeys(thumbs), (key, index) => (
            <SliderThumb
              aria-label={ariaLabel}
              className="border-primary bg-background ring-ring/50 block size-4 shrink-0 cursor-grab rounded-full border shadow-sm transition-[color,box-shadow] select-none hover:ring-4 has-focus-visible:ring-4 data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-dragging:cursor-grabbing"
              index={index}
              key={key}
            />
          ))}
        </SliderTrack>
      </SliderControl>
    </SliderPrimitive>
  );
}

/** One key per thumb slot, so a controlled value that moves never remounts the thumb being dragged. */
function thumbKeys(thumbs: number) {
  return Arr.makeBy(thumbs, (slot) => `thumb-${slot}`);
}

export { Slider };
