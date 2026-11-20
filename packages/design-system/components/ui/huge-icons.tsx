import { HugeiconsIcon } from "@hugeicons/react";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps, ReactElement } from "react";
import { isValidElement } from "react";

/**
 * The sizes an icon is drawn at. `default` is `size-4`, the largest an icon is ever drawn; the smaller steps sit in
 * dense places such as a badge, a checkbox or a grip. A picture that needs more room is drawn artwork, never a
 * bigger icon, so no step goes above `size-4` and no class sizes an icon.
 */
const iconVariants = cva("shrink-0", {
  variants: {
    size: {
      "2xs": "size-2.5",
      xs: "size-3",
      sm: "size-3.5",
      default: "size-4",
    },
  },
  defaultVariants: { size: "default" },
});

/**
 * An icon from the Hugeicons set, at `size-4` unless a smaller `size` step is named. An icon labels: pair it with
 * words or give its control a tooltip. `className` places and colors it; its size comes from `size` alone.
 */
export function HugeIcons({
  className,
  size,
  strokeWidth = 2,
  ...props
}: Omit<ComponentProps<typeof HugeiconsIcon>, "size" | "width" | "height"> &
  VariantProps<typeof iconVariants>) {
  return (
    <HugeiconsIcon
      className={cn(iconVariants({ size }), className)}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}

/**
 * The icon of an option's kind, which every option of a menu or a select shows before its words: a Hugeicons icon, or
 * a mark that stands for the option itself, such as a country's flag or the spinner of an option at work. A `plain`
 * option of a list of values (`OptionMark`) shows none.
 */
export function OptionIcon({
  icon,
}: {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"] | ReactElement | undefined;
}) {
  if (icon === undefined) {
    return null;
  }
  if (isValidElement(icon)) {
    return icon;
  }
  return <HugeIcons icon={icon} />;
}

/**
 * What an option of a list of values shows before its words, one or the other and never neither: the `icon` of its
 * own kind, or `plain` for a list whose options are all values of one kind, such as durations or schools, which
 * would otherwise show one icon on every option.
 */
export type OptionMark =
  | {
      icon: NonNullable<ComponentProps<typeof OptionIcon>["icon"]>;
      plain?: never;
    }
  | { icon?: never; plain: true };
