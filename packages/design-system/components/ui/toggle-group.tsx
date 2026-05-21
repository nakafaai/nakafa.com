"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { toggleVariants } from "@repo/design-system/components/ui/toggle";
import { cn } from "@repo/design-system/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { createContext, useContext } from "react";

type ToggleGroupLayout = "default" | "grid";

type ToggleGroupContextValue = VariantProps<typeof toggleVariants> & {
  layout: ToggleGroupLayout;
};

const ToggleGroupContext = createContext<ToggleGroupContextValue>({
  layout: "default",
  size: "default",
  variant: "default",
});

const toggleGroupRootVariants = cva(
  "group/toggle-group flex w-fit items-center rounded-md data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[variant=outline]:shadow-xs",
  {
    variants: {
      layout: {
        default: "",
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
      default:
        "group-data-[orientation=vertical]/toggle-group:w-full group-data-[orientation=vertical]/toggle-group:flex-none group-data-[orientation=vertical]/toggle-group:border-t-0 group-data-[orientation=horizontal]/toggle-group:border-l-0 group-data-[orientation=horizontal]/toggle-group:last:rounded-r-md group-data-[orientation=vertical]/toggle-group:last:rounded-b-md group-data-[orientation=vertical]/toggle-group:first:rounded-t-md group-data-[orientation=horizontal]/toggle-group:first:rounded-l-md group-data-[orientation=vertical]/toggle-group:first:border-t group-data-[orientation=horizontal]/toggle-group:first:border-l",
      grid: "rounded-none border-0 bg-background hover:bg-accent data-pressed:bg-accent",
    },
  },
  defaultVariants: {
    layout: "default",
  },
});

type ToggleGroupBaseProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  "defaultValue" | "multiple" | "onValueChange" | "value"
> &
  VariantProps<typeof toggleVariants> & {
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
 * Renders a single-select or multi-select toggle group.
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
  variant,
  size,
  children,
  defaultValue,
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

  /**
   * Publishes only the selected item instead of Base UI's single-item array.
   */
  function handleValueChange(nextValue: string[]) {
    onValueChange?.(nextValue[0] ?? "");
  }

  return (
    <ToggleGroupPrimitive
      className={cn(toggleGroupRootVariants({ layout }), className)}
      data-layout={layout}
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
      <ToggleGroupContext.Provider value={{ layout, variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

/**
 * Renders Base UI's multiple selection mode while preserving shared visual variants.
 */
function MultipleToggleGroup({
  className,
  variant,
  size,
  children,
  orientation = "horizontal",
  layout = "default",
  type,
  ...props
}: ToggleGroupMultipleProps) {
  return (
    <ToggleGroupPrimitive
      className={cn(toggleGroupRootVariants({ layout }), className)}
      data-layout={layout}
      data-orientation={orientation}
      data-size={size}
      data-slot="toggle-group"
      data-type={type}
      data-variant={variant}
      multiple
      orientation={orientation}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ layout, variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
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
  const context = useContext(ToggleGroupContext);
  const itemSize = context.size || size;
  const itemVariant = context.variant || variant;

  return (
    <TogglePrimitive
      className={cn(
        toggleVariants({
          variant: itemVariant,
          size: itemSize,
        }),
        "relative min-w-0 flex-1 shrink-0 rounded-none shadow-none hover:z-10 focus:z-10 focus-visible:z-10 data-pressed:z-10",
        toggleGroupItemLayoutVariants({ layout: context.layout }),
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
