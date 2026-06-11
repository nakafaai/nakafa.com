import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { cn } from "@repo/design-system/lib/utils";

interface SpinnerProps
  extends Omit<React.ComponentProps<typeof HugeIcons>, "icon"> {
  icon?: React.ComponentProps<typeof HugeIcons>["icon"];
  isLoading?: boolean;
}

/**
 * Renders Nakafa's loading affordance with Hugeicons.
 * Passing an icon keeps the same sizing contract while `isLoading` forces spin.
 */
export function Spinner({
  className,
  isLoading,
  icon,
  ...props
}: SpinnerProps) {
  return (
    <HugeIcons
      className={cn(
        "shrink-0",
        (isLoading || !icon) && "animate-spin",
        className
      )}
      icon={isLoading || !icon ? Loading03Icon : icon}
      role="status"
      {...props}
    />
  );
}
