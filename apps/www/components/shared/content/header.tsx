import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";

interface Props {
  /** The description of the content */
  description?: string;
  /** BCP 47 language of the description when it differs from the page */
  descriptionLanguage?: string;
  /** The icon of the title */
  icon?: IconSvgElement;
  /** The link to go some where, it will be shown as a button on top of the title */
  link?: {
    href: string;
    label: string;
  };
  /** The title of the content */
  title: string;
}

/** Renders the content title, optional parent link, and description. */
export function HeaderContent({
  title,
  link,
  description,
  descriptionLanguage,
  icon: Icon,
}: Props) {
  return (
    <header className="relative py-20">
      <div className="z-10 mx-auto max-w-3xl space-y-6 px-6">
        <div className="flex flex-col gap-3">
          {!!link && (
            <NavigationLink
              aria-label={link.label}
              className="w-fit font-medium text-primary text-sm underline-offset-4 hover:underline"
              href={link.href}
              title={link.label}
            >
              {link.label}
            </NavigationLink>
          )}
          <div className="flex items-start gap-2">
            {!!Icon && (
              <HugeIcons
                className="hidden size-7 shrink-0 translate-y-1 sm:block"
                icon={Icon}
              />
            )}
            <h1 className="font-medium text-3xl leading-tight tracking-tight">
              {title}
            </h1>
          </div>
        </div>

        {!!description && (
          <div className="space-y-3">
            <p className="text-muted-foreground" lang={descriptionLanguage}>
              {description}
            </p>
          </div>
        )}
      </div>
    </header>
  );
}
