import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "cn";

interface SpinnerProps
  extends Omit<React.ComponentProps<typeof HugeIcons>, "icon"> {
  icon?: React.ComponentProps<typeof HugeIcons>["icon"];
  isLoading?: boolean;
  /**
   * The name a screen reader gives the spinner when it is the only sign of
   * work. Leave it out beside visible text that already says what loads: the
   * spinner is then hidden from assistive technology.
   */
  label?: string;
}

/**
 * A small turning mark for an action that is running, beside the words that say what is running.
 */
function Spinner({
  className,
  isLoading,
  icon,
  label,
  ...props
}: SpinnerProps) {
  const spins = isLoading || !icon;
  return (
    <HugeIcons
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("shrink-0", spins && "animate-spin", className)}
      // Only a turning mark is a spinner: at rest it is its action's icon, which no reader takes for a wait.
      data-slot={spins ? "spinner" : undefined}
      icon={spins ? Loading03Icon : icon}
      role={label ? "status" : undefined}
      {...props}
    />
  );
}

export { Spinner };
