import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import type { ReactNode } from "react";
import { TryoutIntentLink } from "@/components/tryout/navigation/link.client";

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
      <TryoutIntentLink
        className="w-fit font-medium text-primary text-sm underline-offset-4 hover:underline"
        href={link.href}
      >
        {link.label}
      </TryoutIntentLink>

      <div className="space-y-3">
        {meta}

        <div className="flex items-start gap-2">
          <TryoutPageIcon icon={icon} />
          <h1 className="text-pretty font-medium text-3xl leading-tight tracking-tight">
            {title}
          </h1>
        </div>
      </div>

      <TryoutPageCopy content={description} />
      <TryoutPageCopy content={status} />
    </header>
  );
}

/** Renders an optional try-out heading icon at supported viewport sizes. */
function TryoutPageIcon({ icon }: { icon: IconSvgElement | undefined }) {
  if (!icon) {
    return null;
  }

  return (
    <HugeIcons
      className="hidden size-7 shrink-0 translate-y-1 sm:block"
      icon={icon}
    />
  );
}

/** Renders optional concise copy with the shared page-header treatment. */
function TryoutPageCopy({ content }: { content: ReactNode | undefined }) {
  if (content === undefined || content === null) {
    return null;
  }

  return <p className="max-w-2xl text-muted-foreground">{content}</p>;
}
