import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Link, type LinkTarget } from "@/lib/routing/link";

type SubjectItemProps = Readonly<{
  icon: IconSvgElement;
  label: string;
  labelElement?: "h2" | "span";
  target: LinkTarget;
}>;

/** Renders one title-only chooser row for domains whose row contract has no description. */
export function SubjectItem({
  icon,
  label,
  labelElement: Heading = "h2",
  target,
}: SubjectItemProps) {
  return (
    <Link className="group block min-w-0" title={label} {...target}>
      <div className="relative overflow-hidden p-6 transition-colors ease-out group-hover:bg-accent group-hover:text-accent-foreground">
        <div className="flex items-center gap-2">
          <HugeIcons className="size-4 shrink-0" icon={icon} />
          <Heading className="flex-1 truncate" title={label}>
            {label}
          </Heading>
          <HugeIcons
            className="size-4 shrink-0 opacity-0 transition-opacity ease-out group-hover:opacity-100"
            icon={ArrowRight02Icon}
          />
        </div>
      </div>
    </Link>
  );
}
