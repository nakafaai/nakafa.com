import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { type ComponentProps, isValidElement, type ReactElement } from "react";

/** Nakafa's one icon size and its largest, `size-4`, in pixels. */
const ICON_PIXELS = 16;

/**
 * A Hugeicons icon at `size-4`, Nakafa's one icon size: the library draws 24px when nothing sizes it, so the wrapper
 * draws 16px and takes no size from its caller. Only a part of the design system, such as a checkbox's tick, shrinks
 * the icons inside it with a selector (`scripts/check/icons.ts`).
 */
export function HugeIcons({
  className,
  strokeWidth = 2,
  ...props
}: Omit<ComponentProps<typeof HugeiconsIcon>, "size">) {
  return (
    <HugeiconsIcon
      className={cn("shrink-0", className)}
      size={ICON_PIXELS}
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
