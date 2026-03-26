import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { cn } from "@repo/design-system/lib/utils";
import type { ComponentProps } from "react";

interface Props {
  href: string;
  icon: IconSvgElement;
  label: string;
}

export function SubjectList({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      {...props}
      className={cn(
        "grid divide-y overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
        className
      )}
    />
  );
}

export function SubjectItem({ icon, label, href }: Props) {
  return (
    <NavigationLink className="group block min-w-0" href={href} title={label}>
      <div className="relative overflow-hidden p-6 transition-colors ease-out group-hover:bg-accent group-hover:text-accent-foreground">
        <div className="flex items-center gap-2">
          <HugeIcons className="size-5 shrink-0" icon={icon} />
          <h2 className="flex-1 truncate" title={label}>
            {label}
          </h2>
          <HugeIcons
            className="size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100"
            icon={ArrowRight02Icon}
          />
        </div>
      </div>
    </NavigationLink>
  );
}
