import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import type { ReactNode } from "react";

/** Cohesive content model for the compact try-out page header. */
export interface TryoutPageHeaderValue {
  description?: ReactNode;
  icon?: IconSvgElement;
  link: {
    href: string;
    label: string;
  };
  meta?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
}

/**
 * Renders the compact try-out page header with parent navigation and optional
 * concise state or set-introduction copy.
 */
export function TryoutPageHeader({ value }: { value: TryoutPageHeaderValue }) {
  const { description, icon, link, meta, status, title } = value;

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

      {status ? (
        <p className="max-w-2xl text-muted-foreground">{status}</p>
      ) : null}
    </header>
  );
}
