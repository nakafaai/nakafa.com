import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { toggleVariants } from "@repo/design-system/lib/toggle/variants";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Schema } from "effect";
import type * as React from "react";
import { createContext, use, useMemo } from "react";

const ToggleGroupLayoutSchema = Schema.Literals(["default", "grid"]);

type ToggleGroupLayout = typeof ToggleGroupLayoutSchema.Type;

const ToggleGroupContextSchema = Schema.Struct({
  layout: ToggleGroupLayoutSchema,
});

type ToggleGroupContextValue = VariantProps<typeof toggleVariants> &
  typeof ToggleGroupContextSchema.Type;

const ToggleGroupContext = createContext<ToggleGroupContextValue>({
  layout: "default",
  size: "default",
  variant: "outline",
});

/** Shares a group's resolved layout and visual variants with its items. */
function ToggleGroupStyle({
  children,
  layout,
  size,
  variant,
}: ToggleGroupContextValue & { children: React.ReactNode }) {
  const style = useMemo(
    () => ({ layout, size, variant }),
    [layout, size, variant]
  );
  return <ToggleGroupContext value={style}>{children}</ToggleGroupContext>;
}

/**
 * A group lays its items in equal columns, each as wide as the widest item's label and never narrower, so no label
 * runs into its neighbour. `auto-cols-[1fr]` keeps the track's content minimum that `auto-cols-fr` (a zero minimum)
 * drops.
 */
const toggleGroupRootVariants = cva(
  "group/toggle-group w-fit rounded-md data-[variant=outline]:shadow-xs",
  {
    variants: {
      gridColumns: {
        auto: "grid w-full grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]",
        "2": "grid w-full auto-cols-[1fr] grid-flow-col",
        "3": "grid w-full grid-cols-1 sm:grid-cols-3",
        "4": "grid w-full grid-cols-2 sm:grid-cols-4",
        "4-lg": "grid w-full grid-cols-2 lg:grid-cols-4",
        "6": "grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
      },
      layout: {
        default:
          "inline-grid auto-cols-[1fr] grid-flow-col items-stretch data-[orientation=vertical]:w-full data-[orientation=vertical]:grid-flow-row",
        grid: "gap-px overflow-hidden rounded-md data-[variant=outline]:border data-[variant=outline]:bg-border",
      },
    },
    defaultVariants: {
      layout: "default",
    },
  }
);

const toggleGroupItemLayoutVariants = cva("", {
  variants: {
    layout: {
      // Only the outline variant draws a border on each item, so only it drops the border between
      // joined items and keeps the first one's; a default item has no border (as shadcn scopes it).
      default:
        "group-data-[orientation=vertical]/toggle-group:data-[variant=outline]:border-t-0 group-data-[orientation=horizontal]/toggle-group:data-[variant=outline]:border-l-0 group-data-[orientation=horizontal]/toggle-group:last:rounded-r-md group-data-[orientation=vertical]/toggle-group:last:rounded-b-md group-data-[orientation=vertical]/toggle-group:first:rounded-t-md group-data-[orientation=horizontal]/toggle-group:first:rounded-l-md group-data-[orientation=vertical]/toggle-group:data-[variant=outline]:first:border-t group-data-[orientation=horizontal]/toggle-group:data-[variant=outline]:first:border-l",
      grid: "rounded-none border-0 bg-background hover:bg-accent hover:text-accent-foreground data-pressed:bg-accent",
    },
  },
  defaultVariants: {
    layout: "default",
  },
});

/** An item's side padding, wider than a lone toggle's so an icon and a label sit clear of the borders. */
const toggleGroupItemPaddingVariants = cva("", {
  variants: {
    size: {
      default: "px-3",
      lg: "px-3.5",
      sm: "px-2.5",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

type ToggleGroupGridColumns = NonNullable<
  VariantProps<typeof toggleGroupRootVariants>["gridColumns"]
>;

type ToggleGroupBaseProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  "defaultValue" | "multiple" | "onValueChange" | "value"
> &
  VariantProps<typeof toggleVariants> & {
    gridColumns?: ToggleGroupGridColumns;
    layout?: ToggleGroupLayout;
  };

type ToggleGroupSingleProps = ToggleGroupBaseProps & {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  type?: "single";
  value?: string;
};

type ToggleGroupMultipleProps = ToggleGroupBaseProps & {
  defaultValue?: readonly string[];
  onValueChange?: (value: string[]) => void;
  type: "multiple";
  value?: readonly string[];
};

type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

/**
 * Renders a single-select or multi-select toggle group: joined outline segments of equal width, never ghost.
 */
function ToggleGroup(props: ToggleGroupProps) {
  if (isMultipleToggleGroupProps(props)) {
    return <MultipleToggleGroup {...props} />;
  }

  return <SingleToggleGroup {...props} />;
}

/**
 * Adapts Base UI's array value model to the single string value used by our API.
 */
function SingleToggleGroup({
  className,
  variant = "outline",
  size,
  children,
  defaultValue,
  gridColumns,
  onValueChange,
  orientation = "horizontal",
  layout = "default",
  type = "single",
  value,
  ...props
}: ToggleGroupSingleProps) {
  const groupDefaultValue =
    defaultValue === undefined ? undefined : toSingleValueArray(defaultValue);
  const groupValue =
    value === undefined ? undefined : toSingleValueArray(value);
  const resolvedLayout = getResolvedLayout(layout, gridColumns);

  /**
   * Publishes only the selected item instead of Base UI's single-item array.
   */
  function handleValueChange(nextValue: string[]) {
    onValueChange?.(nextValue[0] ?? "");
  }

  return (
    <ToggleGroupPrimitive
      className={cn(
        toggleGroupRootVariants({
          gridColumns,
          layout: resolvedLayout,
        }),
        className
      )}
      data-grid-columns={gridColumns}
      data-layout={resolvedLayout}
      data-orientation={orientation}
      data-size={size}
      data-slot="toggle-group"
      data-type={type}
      data-variant={variant}
      defaultValue={groupDefaultValue}
      onValueChange={handleValueChange}
      orientation={orientation}
      value={groupValue}
      {...props}
    >
      <ToggleGroupStyle layout={resolvedLayout} size={size} variant={variant}>
        {children}
      </ToggleGroupStyle>
    </ToggleGroupPrimitive>
  );
}

/**
 * Renders Base UI's multiple selection mode while preserving shared visual variants.
 */
function MultipleToggleGroup({
  className,
  variant = "outline",
  size,
  children,
  gridColumns,
  orientation = "horizontal",
  layout = "default",
  type,
  ...props
}: ToggleGroupMultipleProps) {
  const resolvedLayout = getResolvedLayout(layout, gridColumns);

  return (
    <ToggleGroupPrimitive
      className={cn(
        toggleGroupRootVariants({
          gridColumns,
          layout: resolvedLayout,
        }),
        className
      )}
      data-grid-columns={gridColumns}
      data-layout={resolvedLayout}
      data-orientation={orientation}
      data-size={size}
      data-slot="toggle-group"
      data-type={type}
      data-variant={variant}
      multiple
      orientation={orientation}
      {...props}
    >
      <ToggleGroupStyle layout={resolvedLayout} size={size} variant={variant}>
        {children}
      </ToggleGroupStyle>
    </ToggleGroupPrimitive>
  );
}

/**
 * Grid column presets opt into the grid layout while leaving the default group unchanged.
 */
function getResolvedLayout(
  layout: ToggleGroupLayout,
  gridColumns?: ToggleGroupGridColumns
): ToggleGroupLayout {
  if (gridColumns) {
    return "grid";
  }

  return layout;
}

/**
 * Narrows the union so each Base UI mode receives the correct value shape.
 */
function isMultipleToggleGroupProps(
  props: ToggleGroupProps
): props is ToggleGroupMultipleProps {
  return props.type === "multiple";
}

/**
 * Converts the public single-value API into Base UI's array API.
 */
function toSingleValueArray(value: string) {
  if (!value) {
    return [];
  }

  return [value];
}

/**
 * Renders a toggle button that inherits its size and variant from the parent group.
 */
function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive> &
  VariantProps<typeof toggleVariants>) {
  const {
    layout: groupLayout,
    size: groupSize,
    variant: groupVariant,
  } = use(ToggleGroupContext);
  const itemSize = groupSize || size;
  const itemVariant = groupVariant || variant;

  return (
    <TogglePrimitive
      className={cn(
        toggleVariants({
          variant: itemVariant,
          size: itemSize,
        }),
        "relative rounded-none shadow-none hover:z-10 focus:z-10 focus-visible:z-10 data-pressed:z-10",
        groupLayout === "default"
          ? toggleGroupItemPaddingVariants({ size: itemSize })
          : undefined,
        toggleGroupItemLayoutVariants({ layout: groupLayout }),
        className
      )}
      data-size={itemSize}
      data-slot="toggle-group-item"
      data-variant={itemVariant}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };
