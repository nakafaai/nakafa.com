import { Loading03Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { cn } from "@repo/design-system/lib/utils";

interface SpinnerProps
  extends Omit<React.ComponentProps<typeof HugeIcons>, "icon"> {
  isLoading?: boolean;
  icon?: React.ComponentProps<typeof HugeIcons>["icon"];
}

function Spinner({ className, isLoading, icon, ...props }: SpinnerProps) {
  return (
    <HugeIcons
      className={cn(
        "size-4 shrink-0",
        (isLoading || !icon) && "animate-spin",
        className
      )}
      icon={isLoading || !icon ? Loading03Icon : icon}
      role="status"
      {...props}
    />
  );
}

export { Spinner };
