import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ReactNode } from "react";

interface TryoutPageHeaderProps {
  description?: ReactNode;
  icon?: IconSvgElement;
  link: {
    href: string;
    label: string;
  };
  meta?: ReactNode;
  title: ReactNode;
}

export function TryoutPageHeader({
  description,
  icon,
  link,
  meta,
  title,
}: TryoutPageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <NavigationLink
        className="w-fit font-medium text-primary text-sm underline-offset-4 hover:underline"
        href={link.href}
      >
        {link.label}
      </NavigationLink>

      <div className="space-y-3">
        {meta}

        <div className="flex items-start gap-2">
          {icon ? (
            <HugeIcons
              className="hidden size-7 shrink-0 translate-y-1 sm:block"
              icon={icon}
            />
          ) : null}
          <h1 className="text-pretty font-medium text-3xl leading-tight tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      {description ? (
        <p className="max-w-2xl text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}
