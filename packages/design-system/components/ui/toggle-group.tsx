import type { NodeChildren } from "@repo/design-system/lib/render";
import { toggleVariants } from "@repo/design-system/lib/toggle/variants";
import {
  ToggleGroup as ToggleGroupPrimitive,
  Toggle as TogglePrimitive,
} from "@ui-sdk/react/toggle";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
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
 * A group sets its items side by side, each as wide as its own label and its padding, and a wider group shares the room
 * left over equally, so every label keeps the same distance from its lines however long it is. Equal columns would
 * crowd the longest label against its lines while a short one floats. Preset `gridColumns` keep their columns.
 */
const toggleGroupRootVariants = cva(
  "group/toggle-group w-fit rounded-md data-[variant=outline]:shadow-xs",
  {
    variants: {
      gridColumns: {
        auto: "grid w-full grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]",
        "2": "grid w-full auto-cols-[1fr] grid-flow-col",
        "2-sm": "grid w-full grid-cols-1 sm:grid-cols-2",
        "3": "grid w-full grid-cols-1 sm:grid-cols-3",
        "4": "grid w-full grid-cols-2 sm:grid-cols-4",
        "4-lg": "grid w-full grid-cols-2 lg:grid-cols-4",
        "6": "grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
      },
      layout: {
        default:
          "inline-flex items-stretch data-[orientation=vertical]:w-full data-[orientation=vertical]:flex-col",
        grid: "data-[variant=outline]:bg-border gap-px overflow-hidden rounded-md data-[variant=outline]:border",
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
        "flex-auto group-data-[orientation=horizontal]/toggle-group:first:rounded-l-md group-data-[orientation=vertical]/toggle-group:first:rounded-t-md group-data-[orientation=horizontal]/toggle-group:last:rounded-r-md group-data-[orientation=vertical]/toggle-group:last:rounded-b-md group-data-[orientation=horizontal]/toggle-group:data-[variant=outline]:border-l-0 group-data-[orientation=vertical]/toggle-group:data-[variant=outline]:border-t-0 group-data-[orientation=horizontal]/toggle-group:data-[variant=outline]:first:border-l group-data-[orientation=vertical]/toggle-group:data-[variant=outline]:first:border-t",
      grid: "bg-background hover:bg-accent hover:text-accent-foreground data-pressed:bg-accent rounded-none border-0",
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

type ToggleGroupRestProps = Omit<
  NodeChildren<React.ComponentProps<typeof ToggleGroupPrimitive>>,
  "defaultValue" | "multiple" | "onValueChange" | "orientation" | "value"
>;

type ToggleGroupValueProps =
  | {
      defaultValue?: string;
      onValueChange?: (value: string) => void;
      type?: "single";
      value?: string;
    }
  | {
      defaultValue?: readonly string[];
      onValueChange?: (value: string[]) => void;
      type: "multiple";
      value?: readonly string[];
    };

type ToggleGroupProps = ToggleGroupRestProps &
  ToggleGroupValueProps &
  VariantProps<typeof toggleVariants> & {
    gridColumns?: ToggleGroupGridColumns;
    layout?: ToggleGroupLayout;
    orientation?: "horizontal" | "vertical";
  };

/**
 * A row of joined outline toggles of equal inner spacing, never ghost. `type="single"`, the default, keeps one value
 * as a string, empty when nothing is pressed; `type="multiple"` keeps an array.
 */
function ToggleGroup({
  className,
  variant = "outline",
  size,
  children,
  gridColumns,
  orientation = "horizontal",
  layout = "default",
  ...props
}: ToggleGroupProps) {
  const resolvedLayout = gridColumns ? "grid" : layout;

  return (
    <ToggleGroupPrimitive
      className={cn(
        toggleGroupRootVariants({ gridColumns, layout: resolvedLayout }),
        className
      )}
      data-grid-columns={gridColumns}
      data-layout={resolvedLayout}
      data-size={size}
      data-variant={variant}
      orientation={orientation}
      {...valueProps(props)}
    >
      <ToggleGroupStyle layout={resolvedLayout} size={size} variant={variant}>
        {children}
      </ToggleGroupStyle>
    </ToggleGroupPrimitive>
  );
}

/**
 * The group's own props, with a single group's string value read as the array of the one pressed toggle. A value the
 * caller leaves out stays out, so the group keeps its own state.
 */
function valueProps(props: ToggleGroupValueProps & ToggleGroupRestProps) {
  if (props.type === "multiple") {
    const { type: _type, defaultValue, value, ...rest } = props;
    return {
      ...rest,
      ...(defaultValue === undefined
        ? {}
        : { defaultValue: [...defaultValue] }),
      ...(value === undefined ? {} : { value: [...value] }),
      multiple: true,
    };
  }
  const { type: _type, defaultValue, onValueChange, value, ...rest } = props;
  return {
    ...rest,
    ...(defaultValue === undefined
      ? {}
      : { defaultValue: toPressed(defaultValue) }),
    ...(value === undefined ? {} : { value: toPressed(value) }),
    onValueChange: (next: string[]) => onValueChange?.(next[0] ?? ""),
  };
}

/** A single group's string as the pressed toggles' values: none for an empty string. */
function toPressed(value: string) {
  return value ? [value] : [];
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
      data-variant={itemVariant}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };
