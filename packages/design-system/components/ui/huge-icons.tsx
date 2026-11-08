import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "cn";
import { type ComponentProps, isValidElement, type ReactElement } from "react";

export function HugeIcons({
  className,
  strokeWidth = 2,
  ...props
}: ComponentProps<typeof HugeiconsIcon>) {
  return (
    <HugeiconsIcon
      className={cn("shrink-0", className)}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}

/**
 * The icon of an option's kind, which every option of a menu or a select shows before its words: a Hugeicons icon, or
 * a mark that stands for the option itself, such as a country's flag or the spinner of an option at work.
 */
export function OptionIcon({
  icon,
}: {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"] | ReactElement;
}) {
  if (isValidElement(icon)) {
    return icon;
  }
  return <HugeIcons icon={icon} />;
}
