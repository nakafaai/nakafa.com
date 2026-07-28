import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";

type SubjectItemProps = Readonly<{
  href: string;
  icon: IconSvgElement;
  label: string;
  labelElement?: "h2" | "span";
}>;

/** Renders one title-only chooser row for domains whose row contract has no description. */
export function SubjectItem({
  icon,
  label,
  href,
  labelElement: Label = "h2",
}: SubjectItemProps) {
  return (
    <NavigationLink className="group block min-w-0" href={href} title={label}>
      <div className="relative overflow-hidden p-6 transition-colors ease-out group-hover:bg-accent group-hover:text-accent-foreground">
        <div className="flex items-center gap-2">
          <HugeIcons className="size-5 shrink-0" icon={icon} />
          <Label className="flex-1 truncate" title={label}>
            {label}
          </Label>
          <HugeIcons
            className="size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100"
            icon={ArrowRight02Icon}
          />
        </div>
      </div>
    </NavigationLink>
  );
}
