import { Calendar03Icon, QuillWrite01Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { format } from "date-fns";
import { OpenContent } from "@/components/shared/open-content";

interface Props {
  /** The authors of the content */
  authors?: {
    name: string;
  }[];
  /** The category of the content */
  category?: {
    icon: IconSvgElement;
    name: string;
  };
  /** The raw content, used for copying */
  content?: string;
  /** The date of the content creation */
  date?: string;
  /** The description of the content */
  description?: string;
  /** The github url of the content */
  githubUrl?: string;
  /** The icon of the title */
  icon?: IconSvgElement;
  /** The link to go some where, it will be shown as a button on top of the title */
  link?: {
    href: string;
    label: string;
  };
  /** The slug of the content */
  slug?: string;
  /** The title of the content */
  title: string;
}

export function HeaderContent({
  title,
  link,
  description,
  icon: Icon,
  category,
  authors,
  date,
  slug,
  content,
}: Props) {
  const showFooter = authors || date;
  return (
    <header className="relative py-20" data-pagefind-ignore>
      <div className="z-10 mx-auto max-w-3xl space-y-6 px-6">
        <div className="flex flex-col gap-3">
          {!!link && (
            <NavigationLink
              aria-label={link.label}
              className="w-fit font-medium text-primary text-sm underline-offset-4 hover:underline"
              href={link.href}
              prefetch
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

        {(!!description || !!showFooter) && (
          <div className="space-y-3">
            {!!description && (
              <p className="text-muted-foreground">{description}</p>
            )}
            {!!showFooter && (
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
                {!!authors && (
                  <p className="inline-flex items-center gap-1 text-muted-foreground">
                    <HugeIcons
                      className="size-4 shrink-0"
                      icon={QuillWrite01Icon}
                    />
                    <span className="text-sm">
                      {authors.map((author) => author.name).join(", ")}
                    </span>
                  </p>
                )}

                <div className="flex items-center gap-4">
                  {!!date && (
                    <p className="inline-flex items-center gap-1 text-muted-foreground">
                      <HugeIcons
                        className="size-4 shrink-0"
                        icon={Calendar03Icon}
                      />
                      <span className="text-sm">
                        {format(date, "d MMM, yyyy")}
                      </span>
                    </p>
                  )}

                  {!!category && (
                    <p className="inline-flex items-center gap-1 text-muted-foreground">
                      <HugeIcons
                        className="size-4 shrink-0"
                        icon={category.icon}
                      />
                      <span className="text-sm">{category.name}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!!slug && <OpenContent content={content} slug={slug} />}
      </div>
    </header>
  );
}
