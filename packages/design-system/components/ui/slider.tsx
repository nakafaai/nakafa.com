import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { cn } from "cn";
import { Array as Arr } from "effect";

/**
 * Renders a Base UI slider using the active shadcn base registry anatomy.
 *
 * Base UI keeps pointer, keyboard, form, and multi-thumb behavior in the
 * primitive. The wrapper only owns Nakafa's visual treatment and cursor affordance.
 *
 * @see https://ui.shadcn.com/docs/components/base/slider
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

  if (Arr.isArray(defaultValue)) {
    thumbCount = defaultValue.length;
  }

  if (Arr.isArray(value)) {
    thumbCount = value.length;
  }

  const thumbKeys = createThumbKeys(thumbCount);

  // The root is a plain `w-full`, so a caller's width wins the merge. A data variant would outrank that width
  // in the cascade, and in a row that sizes to its content the track would measure nothing and only the thumb show.
  return (
    <SliderPrimitive.Root
      className={cn(
        "w-full data-vertical:h-full data-vertical:w-auto",
        className
      )}
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
          "relative flex w-full cursor-pointer touch-none items-center select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-44 data-vertical:w-auto data-vertical:flex-col"
        )}
      >
        <SliderPrimitive.Track
          className={cn(
            "border-input bg-background relative grow cursor-pointer overflow-hidden rounded-full border select-none data-disabled:cursor-not-allowed data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5"
          )}
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className={cn(
              "bg-primary select-none data-horizontal:h-full data-vertical:w-full"
            )}
            data-slot="slider-range"
          />
        </SliderPrimitive.Track>
        {Arr.map(thumbKeys, (thumbKey, thumbIndex) => (
          <SliderPrimitive.Thumb
            aria-label={ariaLabel}
            className="border-primary bg-background ring-ring/50 block size-4 shrink-0 cursor-grab rounded-full border shadow-sm transition-[color,box-shadow] select-none hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-dragging:cursor-grabbing"
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
 * Creates stable thumb keys by slot so controlled value updates do not remount
 * the active thumb during pointer interaction.
 */
function createThumbKeys(thumbCount: number) {
  return Array.from(
    { length: thumbCount },
    (_, thumbSlot) => `thumb-slot-${thumbSlot}`
  );
}

export { Slider };
